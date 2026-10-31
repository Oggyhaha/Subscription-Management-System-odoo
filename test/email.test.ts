import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  passwordResetTemplate,
  accountInvitationTemplate,
  quotationDeliveryTemplate,
  invoiceDeliveryTemplate,
  paymentConfirmationTemplate,
  renewalReminderTemplate,
  baseEmailHtml,
} from "../src/server/services/email/templates";
import { EmailService } from "../src/server/services/email/email.service";
import * as mailerModule from "../src/server/services/email/mailer";
import { db } from "../src/server/db";

// Mock DB and Mailer for EmailService unit testing
vi.mock("../src/server/db", () => ({
  db: {
    emailDeliveryLog: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe("Email Templates (All 6 Core Notification Types)", () => {
  it("1. Password Reset template generates valid HTML, text, and subject", () => {
    const url = "https://app.brightloop.com/reset-password?token=secret123";
    const res = passwordResetTemplate(url, "Alice Smith");

    expect(res.subject).toContain("Reset your Brightloop Software password");
    expect(res.html).toContain("Alice Smith");
    expect(res.html).toContain(url);
    expect(res.html).toContain("Reset Password");
    expect(res.text).toContain("Alice Smith");
    expect(res.text).toContain(url);
    expect(res.text).toContain("valid for 1 hour");
  });

  it("2. Account Invitation template generates valid credentials payload and role badge", () => {
    const url = "https://app.brightloop.com/login";
    const res = accountInvitationTemplate(url, "Bob Jones", "Staff Member", "TempPass#456!");

    expect(res.subject).toContain("invited to Brightloop Software (Staff Member)");
    expect(res.html).toContain("Bob Jones");
    expect(res.html).toContain("Staff Member");
    expect(res.html).toContain("TempPass#456!");
    expect(res.html).toContain(url);
    expect(res.text).toContain("Bob Jones");
    expect(res.text).toContain("TempPass#456!");
  });

  it("3. Quotation Delivery template includes quote number, formatted total, and CTA", () => {
    const url = "https://app.brightloop.com/customer/quotations/qt_101";
    const res = quotationDeliveryTemplate("QT-2026-000042", "$1,499.00", url, "Acme Enterprises");

    expect(res.subject).toContain("Brightloop Quotation #QT-2026-000042 for Acme Enterprises");
    expect(res.html).toContain("Acme Enterprises");
    expect(res.html).toContain("#QT-2026-000042");
    expect(res.html).toContain("$1,499.00");
    expect(res.html).toContain(url);
    expect(res.text).toContain("Total: $1,499.00");
    expect(res.text).toContain(url);
  });

  it("4. Invoice Delivery template correctly handles polymorphic parameter orders", () => {
    // Signature A: (customerName, invoiceNumber, amountDue, dueDate, viewUrl)
    const resA = invoiceDeliveryTemplate(
      "Globex Corp",
      "INV-2026-000100",
      "$750.00",
      "2026-11-15",
      "https://app.brightloop.com/customer/invoices/inv_1"
    );

    expect(resA.subject).toContain("Invoice #INV-2026-000100");
    expect(resA.subject).toContain("$750.00 due 2026-11-15");
    expect(resA.html).toContain("Globex Corp");
    expect(resA.html).toContain("#INV-2026-000100");
    expect(resA.html).toContain("$750.00");
    expect(resA.html).toContain("2026-11-15");
    expect(resA.html).toContain("https://app.brightloop.com/customer/invoices/inv_1");

    // Signature B: (invoiceNumber, amountDue, dueDate, viewUrl, customerName)
    const resB = invoiceDeliveryTemplate(
      "INV-2026-000100",
      "$750.00",
      "2026-11-15",
      "https://app.brightloop.com/customer/invoices/inv_1",
      "Globex Corp"
    );

    expect(resB.subject).toEqual(resA.subject);
    expect(resB.text).toEqual(resA.text);
  });

  it("5. Payment Confirmation template displays payment reference and active standing", () => {
    const res = paymentConfirmationTemplate(
      "PAY-2026-000088",
      "INV-2026-000100",
      "$750.00",
      "October 31, 2026",
      "Globex Corp"
    );

    expect(res.subject).toContain("Payment Received for Invoice #INV-2026-000100");
    expect(res.html).toContain("Globex Corp");
    expect(res.html).toContain("$750.00");
    expect(res.html).toContain("PAY-2026-000088");
    expect(res.html).toContain("active standing");
    expect(res.text).toContain("PAY-2026-000088");
  });

  it("6. Renewal Reminder template correctly handles polymorphic parameter orders", () => {
    // Signature A: (customerName, subscriptionNumber, planName, renewalDate, renewalAmount)
    const resA = renewalReminderTemplate(
      "Initech LLC",
      "SUB-2026-00055",
      "Enterprise Cloud",
      "2026-12-01",
      "$3,500.00"
    );

    expect(resA.subject).toContain("Upcoming Renewal for Subscription #SUB-2026-00055 (Enterprise Cloud)");
    expect(resA.html).toContain("Initech LLC");
    expect(resA.html).toContain("#SUB-2026-00055");
    expect(resA.html).toContain("Enterprise Cloud");
    expect(resA.html).toContain("2026-12-01");
    expect(resA.html).toContain("$3,500.00");

    // Signature B: (subscriptionNumber, planName, renewalDate, renewalAmount, customerName)
    const resB = renewalReminderTemplate(
      "SUB-2026-00055",
      "Enterprise Cloud",
      "2026-12-01",
      "$3,500.00",
      "Initech LLC"
    );

    expect(resB.subject).toEqual(resA.subject);
    expect(resB.text).toEqual(resA.text);
  });

  it("Base Email HTML layout renders Hallmark semantic markup and footer", () => {
    const html = baseEmailHtml("Test Title", "<p>Test paragraph content</p>", {
      text: "Action CTA",
      url: "https://brightloop.com",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Brightloop Software");
    expect(html).toContain("Test Title");
    expect(html).toContain("Test paragraph content");
    expect(html).toContain("Action CTA");
    expect(html).toContain("https://brightloop.com");
    expect(html).toContain("support@brightloop.com");
    expect(html).toContain(new Date().getFullYear().toString());
  });
});

describe("EmailService Dispatch, Non-blocking SMTP, & Error Sanitization", () => {
  let emailService: EmailService;
  let mockSendMail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService();

    mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg_123" });
    vi.spyOn(mailerModule, "getMailerTransport").mockResolvedValue({
      sendMail: mockSendMail,
    } as unknown as import("nodemailer").Transporter);
    vi.spyOn(mailerModule, "getSenderAddress").mockReturnValue('"Brightloop" <billing@brightloop.com>');
  });

  it("successfully creates log as PENDING, dispatches via transporter, and updates to SENT", async () => {
    const fakeLogId = "log_uuid_1";
    vi.mocked(db.emailDeliveryLog.create).mockResolvedValue({
      id: fakeLogId,
      recipient: "customer@example.com",
      subject: "Test Subject",
      body: "Test Body",
      status: "PENDING",
      invoiceId: "inv_1",
      userId: "user_1",
      sentAt: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.emailDeliveryLog.update).mockResolvedValue({} as unknown as any);

    const result = await emailService.sendEmail({
      to: "customer@example.com",
      subject: "Test Subject",
      html: "<p>Test HTML</p>",
      text: "Test Text",
      invoiceId: "inv_1",
      userId: "user_1",
    });

    expect(result.success).toBe(true);
    expect(result.logId).toBe(fakeLogId);

    // Initial audit log created as PENDING
    expect(db.emailDeliveryLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipient: "customer@example.com",
        subject: "Test Subject",
        status: "PENDING",
        invoiceId: "inv_1",
        userId: "user_1",
      }),
    });

    // Transporter called with recipient and content
    expect(mockSendMail).toHaveBeenCalledWith({
      from: '"Brightloop" <billing@brightloop.com>',
      to: "customer@example.com",
      subject: "Test Subject",
      html: "<p>Test HTML</p>",
      text: "Test Text",
    });

    // Status updated to SENT with timestamp
    expect(db.emailDeliveryLog.update).toHaveBeenCalledWith({
      where: { id: fakeLogId },
      data: expect.objectContaining({
        status: "SENT",
        sentAt: expect.any(Date),
        errorMessage: null,
      }),
    });
  });

  it("handles SMTP failure gracefully without throwing and updates log to FAILED", async () => {
    const fakeLogId = "log_uuid_2";
    vi.mocked(db.emailDeliveryLog.create).mockResolvedValue({
      id: fakeLogId,
      recipient: "broken@example.com",
      subject: "Invoice #INV-2026-99",
      body: "Body",
      status: "PENDING",
      invoiceId: "inv_99",
      userId: null,
      sentAt: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Simulate network error / SMTP timeout
    mockSendMail.mockRejectedValue(new Error("Connection refused: connect ECONNREFUSED 127.0.0.1:1025"));

    const result = await emailService.sendEmail({
      to: "broken@example.com",
      subject: "Invoice #INV-2026-99",
      html: "<p>Invoice</p>",
      text: "Invoice",
      invoiceId: "inv_99",
    });

    // Must NEVER throw an error into the caller
    expect(result.success).toBe(false);
    expect(result.logId).toBe(fakeLogId);
    expect(result.error).toContain("ECONNREFUSED");

    // Status updated to FAILED in database
    expect(db.emailDeliveryLog.update).toHaveBeenCalledWith({
      where: { id: fakeLogId },
      data: expect.objectContaining({
        status: "FAILED",
        errorMessage: expect.stringContaining("ECONNREFUSED"),
      }),
    });
  });

  it("sanitizes passwords, secrets, and auth tokens from error messages", async () => {
    const fakeLogId = "log_uuid_3";
    vi.mocked(db.emailDeliveryLog.create).mockResolvedValue({
      id: fakeLogId,
      recipient: "test@example.com",
      subject: "Test",
      body: "Body",
      status: "PENDING",
      invoiceId: null,
      userId: null,
      sentAt: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Simulate an error that accidentally leaks credentials in SMTP error response
    mockSendMail.mockRejectedValue(
      new Error("SMTP Auth Failed: user=admin pass=SuperSecretPassword123! token=abc_secret_token_xyz")
    );

    const result = await emailService.sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Body</p>",
      text: "Body",
    });

    expect(result.success).toBe(false);
    expect(result.error).not.toContain("SuperSecretPassword123!");
    expect(result.error).not.toContain("abc_secret_token_xyz");
    expect(result.error).toContain("[REDACTED]");
  });

  it("retryFailedEmail successfully redelivers a failed email and updates to SENT", async () => {
    const failedLogId = "log_failed_4";
    vi.mocked(db.emailDeliveryLog.findUnique).mockResolvedValue({
      id: failedLogId,
      recipient: "retry-recipient@example.com",
      subject: "Quotation Delivery",
      body: "Quotation content here",
      status: "FAILED",
      invoiceId: null,
      userId: "usr_10",
      sentAt: null,
      errorMessage: "Previous temporary timeout",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await emailService.retryFailedEmail(failedLogId);

    expect(result.success).toBe(true);
    expect(result.logId).toBe(failedLogId);

    expect(mockSendMail).toHaveBeenCalledWith({
      from: '"Brightloop" <billing@brightloop.com>',
      to: "retry-recipient@example.com",
      subject: "Quotation Delivery",
      text: "Quotation content here",
      html: expect.stringContaining("Quotation content here"),
    });

    expect(db.emailDeliveryLog.update).toHaveBeenCalledWith({
      where: { id: failedLogId },
      data: expect.objectContaining({
        status: "SENT",
        sentAt: expect.any(Date),
        errorMessage: null,
      }),
    });
  });

  it("financial transaction non-blocking guarantee: caller proceeds even if sendEmail fails", async () => {
    // When generating an invoice or recording a payment, the business transaction must commit
    // regardless of whether the email notification fails.
    mockSendMail.mockRejectedValue(new Error("SMTP server down"));

    vi.mocked(db.emailDeliveryLog.create).mockResolvedValue({
      id: "log_fail_5",
      recipient: "cust@corp.com",
      subject: "Invoice #INV-2026-001",
      body: "Invoice details",
      status: "PENDING",
      invoiceId: "inv_123",
      userId: null,
      sentAt: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let invoiceCreated = false;

    // Simulate invoice business workflow
    async function simulateInvoiceWorkflow() {
      // 1. Financial mutation succeeds
      invoiceCreated = true;

      // 2. Email dispatch is attempted
      const emailResult = await emailService.sendEmail({
        to: "cust@corp.com",
        subject: "Invoice #INV-2026-001",
        html: "<p>Invoice</p>",
        text: "Invoice",
        invoiceId: "inv_123",
      });

      // 3. Invoice remains created, function returns successfully
      return { invoiceId: "inv_123", emailDispatched: emailResult.success };
    }

    const workflowResult = await simulateInvoiceWorkflow();

    expect(invoiceCreated).toBe(true);
    expect(workflowResult.invoiceId).toBe("inv_123");
    expect(workflowResult.emailDispatched).toBe(false);
  });
});
