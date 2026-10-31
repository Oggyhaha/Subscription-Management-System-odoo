"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth/guards";
import { EmailService } from "@/server/services/email/email.service";
import {
  passwordResetTemplate,
  accountInvitationTemplate,
  quotationDeliveryTemplate,
  invoiceDeliveryTemplate,
  paymentConfirmationTemplate,
  renewalReminderTemplate,
} from "@/server/services/email/templates";
import { env } from "@/lib/env";
import type { EmailStatus, Prisma } from "@prisma/client";

const emailService = new EmailService();

export interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

export interface EmailLogItem {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  sentAt: Date | null;
  errorMessage: string | null;
  invoiceId: string | null;
  userId: string | null;
  createdAt: Date;
  invoice?: {
    id: string;
    invoiceNumber: string;
  } | null;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

/**
 * Retrieves paginated email delivery logs with filtering and diagnostics
 */
export async function getEmailLogsAction(params: {
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    await requireRole(["ADMIN", "STAFF"]);

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.EmailDeliveryLogWhereInput = {};

    if (params.status && params.status !== "ALL") {
      where.status = params.status as EmailStatus;
    }

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { recipient: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
      ];
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const [total, data, sentCount, failedCount, pendingCount] = await Promise.all([
      db.emailDeliveryLog.count({ where }),
      db.emailDeliveryLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.emailDeliveryLog.count({ where: { status: "SENT" } }),
      db.emailDeliveryLog.count({ where: { status: "FAILED" } }),
      db.emailDeliveryLog.count({ where: { status: "PENDING" } }),
    ]);

    return {
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
      metrics: {
        totalAll: sentCount + failedCount + pendingCount,
        sentCount,
        failedCount,
        pendingCount,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load email delivery logs",
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, pageCount: 0 },
      metrics: { totalAll: 0, sentCount: 0, failedCount: 0, pendingCount: 0 },
    };
  }
}

/**
 * Retries a failed or pending email delivery log
 */
export async function retryEmailLogAction(logId: string): Promise<ActionResult> {
  try {
    await requireRole(["ADMIN", "STAFF"]);

    const res = await emailService.retryFailedEmail(logId);

    revalidatePath("/admin/email-logs");

    if (!res.success) {
      return {
        success: false,
        error: res.error || "Email retry delivery failed",
      };
    }

    return {
      success: true,
      message: "Email successfully delivered and marked SENT.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to retry email delivery",
    };
  }
}

/**
 * Sends a test email for any of the 6 core templates (SMTP sink verification)
 */
export async function sendTestEmailAction(params: {
  recipient: string;
  templateType: "RESET_PASSWORD" | "INVITATION" | "QUOTATION" | "INVOICE" | "PAYMENT" | "RENEWAL";
}): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");

    const to = params.recipient.trim();
    let template;

    switch (params.templateType) {
      case "RESET_PASSWORD":
        template = passwordResetTemplate(`${env.APP_URL}/reset-password?token=test_token`, "Test User");
        break;

      case "INVITATION":
        template = accountInvitationTemplate(`${env.APP_URL}/login`, "Staff Member", "Staff", "TempPass#123!");
        break;

      case "QUOTATION":
        template = quotationDeliveryTemplate("QT-2026-TEST", "$499.00", `${env.APP_URL}/customer/quotations`, "Acme Corp");
        break;

      case "INVOICE":
        template = invoiceDeliveryTemplate("Acme Corp", "INV-2026-TEST", "$499.00", "2026-11-30", `${env.APP_URL}/customer/invoices`);
        break;

      case "PAYMENT":
        template = paymentConfirmationTemplate("PAY-2026-TEST", "INV-2026-TEST", "$499.00", "Oct 31, 2026", "Acme Corp");
        break;

      case "RENEWAL":
        template = renewalReminderTemplate("Acme Corp", "SUB-2026-TEST", "Enterprise Cloud Plan", "Nov 15, 2026", "$499.00");
        break;

      default:
        return { success: false, error: "Invalid template type" };
    }

    const result = await emailService.sendEmail({
      to,
      subject: `[TEST] ${template.subject}`,
      html: template.html,
      text: template.text,
    });

    revalidatePath("/admin/email-logs");

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Test email delivery failed",
      };
    }

    return {
      success: true,
      message: `Test email (${params.templateType}) dispatched successfully to ${to}.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to dispatch test email",
    };
  }
}

