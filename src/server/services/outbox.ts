import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { getMailerTransport, getSenderAddress } from "./email/mailer";
import type { EmailStatus } from "@prisma/client";

export interface OutboxProcessResult {
  processed: number;
  sent: number;
  failed: number;
  items: Array<{
    id: string;
    recipient: string;
    status: EmailStatus;
    error?: string;
  }>;
}

/**
 * Sanitizes errors to prevent secrets from being written to outbox error logs
 */
function sanitizeError(err: unknown): string {
  if (!err) return "Unknown delivery failure";
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/(password|pass|token|secret|auth)[=:]\s*([^\s&]+)/gi, "$1=[REDACTED]")
    .substring(0, 1000);
}

/**
 * Extracts and increments attempt count from error message string: "[Attempt: N] ..."
 */
function extractAttempts(errorMessage?: string | null): number {
  if (!errorMessage) return 0;
  const match = errorMessage.match(/\[Attempts?:\s*(\d+)\]/i);
  return match ? parseInt(match[1], 10) : 1;
}

export class OutboxService {
  /**
   * Enqueues an email into the durable outbox (email_delivery_logs table in PENDING status)
   */
  static async enqueue(options: {
    recipient: string;
    subject: string;
    body: string;
    invoiceId?: string | null;
    userId?: string | null;
  }) {
    return db.emailDeliveryLog.create({
      data: {
        recipient: options.recipient.trim().toLowerCase(),
        subject: options.subject,
        body: options.body,
        status: "PENDING",
        invoiceId: options.invoiceId || null,
        userId: options.userId || null,
      },
    });
  }

  /**
   * Processes pending and failed outbox entries in batches.
   * Doubles as the durable outbox worker invoked by cron and manual retry actions.
   */
  static async processOutbox(options?: {
    batchSize?: number;
    maxAttempts?: number;
  }): Promise<OutboxProcessResult> {
    const batchSize = Math.max(1, Math.min(100, options?.batchSize || 25));
    const maxAttempts = options?.maxAttempts || 5;

    // Fetch batch of PENDING or retriable FAILED emails
    const pendingItems = await db.emailDeliveryLog.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
      },
      take: batchSize,
      orderBy: { createdAt: "asc" },
    });

    const results: OutboxProcessResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      items: [],
    };

    if (pendingItems.length === 0) {
      return results;
    }

    const transporter = await getMailerTransport();
    const from = getSenderAddress();

    for (const item of pendingItems) {
      const currentAttempts = extractAttempts(item.errorMessage);
      if (currentAttempts >= maxAttempts && item.status === "FAILED") {
        // Exceeded maximum attempts, skip processing
        continue;
      }

      results.processed++;
      const nextAttempt = currentAttempts + 1;

      try {
        await transporter.sendMail({
          from,
          to: item.recipient,
          subject: item.subject,
          html: item.body,
          text: item.body.replace(/<[^>]*>/g, ""), // simple fallback text
        });

        // Mark as SENT
        await db.emailDeliveryLog.update({
          where: { id: item.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            errorMessage: null,
          },
        });

        results.sent++;
        results.items.push({
          id: item.id,
          recipient: item.recipient,
          status: "SENT",
        });
      } catch (err: unknown) {
        const sanitized = sanitizeError(err);
        const annotatedError = `[Attempt: ${nextAttempt}] ${sanitized}`;

        // Mark as FAILED
        await db.emailDeliveryLog.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            errorMessage: annotatedError,
          },
        });

        results.failed++;
        results.items.push({
          id: item.id,
          recipient: item.recipient,
          status: "FAILED",
          error: annotatedError,
        });

        logger.warn("Outbox delivery attempt failed", {
          id: item.id,
          recipient: item.recipient,
          attempt: nextAttempt,
          error: sanitized,
        });
      }
    }

    return results;
  }

  /**
   * Retries an individual outbox item manually
   */
  static async retryItem(id: string) {
    const item = await db.emailDeliveryLog.findUnique({
      where: { id },
    });

    if (!item) {
      throw new Error(`Outbox item with ID "${id}" not found`);
    }

    const transporter = await getMailerTransport();
    const from = getSenderAddress();
    const nextAttempt = extractAttempts(item.errorMessage) + 1;

    try {
      await transporter.sendMail({
        from,
        to: item.recipient,
        subject: item.subject,
        html: item.body,
        text: item.body.replace(/<[^>]*>/g, ""),
      });

      return db.emailDeliveryLog.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (err: unknown) {
      const sanitized = sanitizeError(err);
      return db.emailDeliveryLog.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: `[Attempt: ${nextAttempt}] ${sanitized}`,
        },
      });
    }
  }
}

export const processOutbox = OutboxService.processOutbox;

