import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { addInterval, isBefore, formatDate } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { InvoiceService } from "./invoice";
import { OutboxService } from "./outbox";
import { EmailService } from "./email/email.service";
import { renewalReminderTemplate } from "./email/templates";
import { logger } from "@/lib/logger";
import Decimal from "decimal.js";

const emailService = new EmailService();

export interface BillingRunResultItem {
  subscriptionId: string;
  subscriptionNumber: string;
  customerName: string;
  status: "CREATED" | "SKIPPED" | "FAILED";
  invoiceId?: string;
  invoiceNumber?: string;
  amount?: string;
  error?: string;
}

export interface BillingRunSummary {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  results: BillingRunResultItem[];
}

export class BillingService {
  /**
   * Executes due recurring billing for all active subscriptions whose nextBillingDate <= now.
   * - Excludes paused, closed, and draft subscriptions.
   * - Processes each subscription in its own transaction via InvoiceService.generateInvoice.
   * - One failing subscription will NOT stop the batch run.
   * - Handles auto-close for subscriptions reaching expiry.
   * - Returns a complete structured summary.
   */
  static async runDueBilling(
    now: Date = new Date(),
    options?: {
      triggeredBy?: string;
    }
  ): Promise<BillingRunSummary> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startedAt = new Date();

    logger.info("Starting automated billing run", { runId, now: now.toISOString() });

    // 1. Query all ACTIVE subscriptions that have reached their next billing date
    const dueSubscriptions = await db.subscription.findMany({
      where: {
        status: "ACTIVE",
        nextBillingDate: { lte: now },
      },
      include: {
        customer: {
          include: { user: true },
        },
        items: true,
        plan: true,
      },
      orderBy: { nextBillingDate: "asc" },
    });

    const results: BillingRunResultItem[] = [];
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const sub of dueSubscriptions) {
      const customerName = sub.customer.name || sub.customer.user?.name || "Customer";

      // 2. Check Expiry and Auto-Close Logic
      if (sub.expiryDate && isBefore(sub.expiryDate, now)) {
        if (sub.autoCloseAtEnd) {
          try {
            await db.$transaction(async (tx) => {
              await tx.subscription.update({
                where: { id: sub.id },
                data: { status: "CLOSED" },
              });
              await writeAuditLog({
                action: "SUBSCRIPTION_AUTO_CLOSED",
                entityType: "Subscription",
                entityId: sub.id,
                metadata: {
                  reason: "Reached expiry date with autoCloseAtEnd enabled",
                  expiryDate: sub.expiryDate?.toISOString(),
                },
                userId: options?.triggeredBy || null,
              });
            });

            skippedCount++;
            results.push({
              subscriptionId: sub.id,
              subscriptionNumber: sub.subscriptionNumber,
              customerName,
              status: "SKIPPED",
              error: "Auto-closed at contract expiry",
            });
            continue;
          } catch (closeErr) {
            logger.error("Failed to auto-close expired subscription", { subscriptionId: sub.id, error: closeErr });
          }
        } else {
          // Expired without auto-close, skip from billing
          skippedCount++;
          results.push({
            subscriptionId: sub.id,
            subscriptionNumber: sub.subscriptionNumber,
            customerName,
            status: "SKIPPED",
            error: "Subscription expired",
          });
          continue;
        }
      }

      // Check for zero items
      if (sub.items.length === 0) {
        skippedCount++;
        results.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscriptionNumber,
          customerName,
          status: "SKIPPED",
          error: "Subscription has no billable items",
        });
        continue;
      }

      // 3. Process Billing Cycle
      // Calculate cycle interval: periodStart = currentPeriodEnd, periodEnd = addInterval(periodStart, interval, 1)
      const periodStart = sub.currentPeriodEnd || sub.startDate;
      const periodEnd = addInterval(periodStart, sub.billingInterval, 1);

      try {
        const invoice = await InvoiceService.generateInvoice(sub.id, periodStart, periodEnd, {
          createdById: options?.triggeredBy,
          autoSendEmail: true,
        });

        createdCount++;
        results.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscriptionNumber,
          customerName,
          status: "CREATED",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: `$${Number(invoice.totalAmount).toFixed(2)}`,
        });
      } catch (err: unknown) {
        failedCount++;
        const errorMessage = err instanceof Error ? err.message : String(err);

        logger.error("Failed billing cycle for subscription", {
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscriptionNumber,
          error: errorMessage,
        });

        // Record failed attempt audit log
        await writeAuditLog({
          action: "BILLING_CYCLE_FAILED",
          entityType: "Subscription",
          entityId: sub.id,
          metadata: {
            runId,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            error: errorMessage,
          },
          userId: options?.triggeredBy || null,
        });

        results.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscriptionNumber,
          customerName,
          status: "FAILED",
          error: errorMessage,
        });
      }
    }

    const completedAt = new Date();
    const summary: BillingRunSummary = {
      runId,
      startedAt,
      completedAt,
      processed: dueSubscriptions.length,
      created: createdCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    };

    // 4. Record overall BillingRun in AuditLog
    await writeAuditLog({
      action: "BILLING_RUN",
      entityType: "BillingRun",
      entityId: runId,
      metadata: summary as any,
      userId: options?.triggeredBy || null,
    });

    // 5. Trigger Outbox flush to deliver any pending emails
    await OutboxService.processOutbox().catch((outboxErr) => {
      logger.warn("Post-billing outbox flush encountered an issue", { error: outboxErr });
    });

    logger.info("Completed billing run", {
      runId,
      processed: summary.processed,
      created: summary.created,
      skipped: summary.skipped,
      failed: summary.failed,
    });

    return summary;
  }

  /**
   * Retries billing generation for a single subscription
   */
  static async retrySubscriptionBilling(
    subscriptionId: string,
    triggeredBy?: string
  ): Promise<BillingRunResultItem> {
    const sub = await db.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: { include: { user: true } },
        items: true,
      },
    });

    if (!sub) {
      throw AppError.notFound(`Subscription "${subscriptionId}" not found`);
    }

    const customerName = sub.customer.name || sub.customer.user?.name || "Customer";
    const periodStart = sub.currentPeriodEnd || sub.startDate;
    const periodEnd = addInterval(periodStart, sub.billingInterval, 1);

    try {
      const invoice = await InvoiceService.generateInvoice(sub.id, periodStart, periodEnd, {
        createdById: triggeredBy,
        autoSendEmail: true,
      });

      return {
        subscriptionId: sub.id,
        subscriptionNumber: sub.subscriptionNumber,
        customerName,
        status: "CREATED",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: `$${Number(invoice.totalAmount).toFixed(2)}`,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        subscriptionId: sub.id,
        subscriptionNumber: sub.subscriptionNumber,
        customerName,
        status: "FAILED",
        error: errorMessage,
      };
    }
  }

  /**
   * Retrieves paginated billing runs from audit records
   */
  static async getBillingRuns(params?: {
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.max(1, Math.min(50, params?.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const [total, logs] = await Promise.all([
      db.auditLog.count({
        where: {
          action: "BILLING_RUN",
          entityType: "BillingRun",
        },
      }),
      db.auditLog.findMany({
        where: {
          action: "BILLING_RUN",
          entityType: "BillingRun",
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const runs: BillingRunSummary[] = logs.map((log) => {
      let meta: any = {};
      try {
        meta = log.metadata ? JSON.parse(log.metadata) : {};
      } catch {
        meta = {};
      }

      return {
        runId: log.entityId || log.id,
        startedAt: meta.startedAt ? new Date(meta.startedAt) : log.createdAt,
        completedAt: meta.completedAt ? new Date(meta.completedAt) : log.createdAt,
        processed: meta.processed || 0,
        created: meta.created || 0,
        skipped: meta.skipped || 0,
        failed: meta.failed || 0,
        results: meta.results || [],
      };
    });

    return {
      data: runs,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Sends renewal reminder emails for active subscriptions approaching expiry
   */
  static async runRenewalReminders(
    now: Date = new Date(),
    windowDays: number = 14
  ) {
    const maxExpiry = new Date(now);
    maxExpiry.setDate(maxExpiry.getDate() + windowDays);

    const expiringSubscriptions = await db.subscription.findMany({
      where: {
        status: "ACTIVE",
        expiryDate: {
          gte: now,
          lte: maxExpiry,
        },
      },
      include: {
        customer: { include: { user: true } },
        plan: true,
      },
    });

    let remindersSent = 0;

    for (const sub of expiringSubscriptions) {
      const recipient = sub.customer.user?.email || sub.customer.email;
      if (!recipient) continue;

      const customerName = sub.customer.name || sub.customer.user?.name || "Valued Customer";
      const expiryStr = sub.expiryDate ? formatDate(sub.expiryDate) : "Upcoming";
      const template = renewalReminderTemplate(
        customerName,
        sub.subscriptionNumber,
        sub.plan.name,
        expiryStr,
        `$${Number(sub.totalAmount).toFixed(2)}`
      );

      const res = await emailService.sendEmail({
        to: recipient,
        subject: template.subject,
        html: template.html,
        text: template.text,
        userId: sub.customer.userId,
      });

      if (res.success) {
        remindersSent++;
      }
    }

    return {
      subscriptionsChecked: expiringSubscriptions.length,
      remindersSent,
    };
  }
}

