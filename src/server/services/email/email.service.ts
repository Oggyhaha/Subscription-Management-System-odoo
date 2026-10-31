import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import { getMailerTransport, getSenderAddress } from "./mailer";
import type { EmailContent } from "./templates";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  invoiceId?: string | null;
  userId?: string | null;
}

export interface EmailResult {
  success: boolean;
  logId: string;
  error?: string;
}

/**
 * Sanitizes error messages by scrubbing potential passwords, tokens, or credential strings
 */
function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown email delivery failure";
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/(password|pass|token|secret|auth)[=:]\s*([^\s&]+)/gi, "$1=[REDACTED]")
    .substring(0, 1000); // Clamped length for safe DB column storage
}

export class EmailService {
  /**
   * Sends an email, safely logging attempt and result to email_delivery_logs.
   * Guarantees never to throw an unhandled exception into callers.
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    const to = options.to.trim().toLowerCase();
    let logId = "";

    try {
      // 1. Create audit log entry in email_delivery_logs as PENDING
      const logEntry = await db.emailDeliveryLog.create({
        data: {
          recipient: to,
          subject: options.subject,
          body: options.text || options.html,
          status: "PENDING",
          invoiceId: options.invoiceId || null,
          userId: options.userId || null,
        },
      });
      logId = logEntry.id;

      // 2. Dispatch via Nodemailer transport
      const transporter = await getMailerTransport();
      await transporter.sendMail({
        from: getSenderAddress(),
        to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      // 3. Mark as SENT
      await db.emailDeliveryLog.update({
        where: { id: logId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      logger.info(`Email sent successfully to ${to}`, { subject: options.subject, logId });
      return { success: true, logId };
    } catch (err) {
      const sanitized = sanitizeErrorMessage(err);
      logger.error(`Failed to send email to ${to}`, { subject: options.subject, logId }, err);

      if (logId) {
        try {
          await db.emailDeliveryLog.update({
            where: { id: logId },
            data: {
              status: "FAILED",
              errorMessage: sanitized,
            },
          });
        } catch (dbErr) {
          logger.error("Failed to update email log status to FAILED", { logId }, dbErr);
        }
      }

      return {
        success: false,
        logId,
        error: sanitized,
      };
    }
  }

  /**
   * Re-attempts delivery of a previously failed email log entry
   */
  async retryFailedEmail(logId: string): Promise<EmailResult> {
    try {
      const logEntry = await db.emailDeliveryLog.findUnique({
        where: { id: logId },
      });

      if (!logEntry) {
        return {
          success: false,
          logId,
          error: `Email delivery log record ${logId} not found`,
        };
      }

      const transporter = await getMailerTransport();
      await transporter.sendMail({
        from: getSenderAddress(),
        to: logEntry.recipient,
        subject: logEntry.subject,
        text: logEntry.body,
        // Since original HTML might not be separately stored, fallback to body text formatted
        html: `<pre style="font-family: sans-serif; white-space: pre-wrap;">${logEntry.body}</pre>`,
      });

      await db.emailDeliveryLog.update({
        where: { id: logId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      logger.info(`Email retry succeeded for logId ${logId}`);
      return { success: true, logId };
    } catch (err) {
      const sanitized = sanitizeErrorMessage(err);
      logger.error(`Retry failed for email logId ${logId}`, {}, err);

      await db.emailDeliveryLog.update({
        where: { id: logId },
        data: {
          status: "FAILED",
          errorMessage: `[Retry Failed]: ${sanitized}`,
        },
      });

      return {
        success: false,
        logId,
        error: sanitized,
      };
    }
  }
}

export const emailService = new EmailService();

