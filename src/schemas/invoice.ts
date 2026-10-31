import { z } from "zod";

export const generateInvoiceSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription ID is required"),
  periodStart: z.string().or(z.date()).optional(),
  periodEnd: z.string().or(z.date()).optional(),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

export const invoiceStatusEnum = z.enum(["DRAFT", "CONFIRMED", "PAID", "CANCELLED"]);
export type InvoiceStatusType = z.infer<typeof invoiceStatusEnum>;

export const invoiceFilterSchema = z.object({
  status: z.enum(["ALL", "DRAFT", "CONFIRMED", "PAID", "CANCELLED"]).default("ALL"),
  customerId: z.string().optional(),
  paymentState: z.enum(["ALL", "PAID", "UNPAID", "OVERDUE"]).default("ALL"),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;

export const invoiceActionSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  action: z.enum(["CONFIRM", "CANCEL", "MARK_PAID", "SEND"]),
  reason: z.string().trim().nullable().optional(),
  amount: z.coerce.number().positive().optional(),
  paymentMethod: z.enum(["CREDIT_CARD", "BANK_TRANSFER", "UPI", "CASH", "CHECK", "OTHER"]).optional(),
});

export type InvoiceActionInput = z.infer<typeof invoiceActionSchema>;

export const sendInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  recipientEmail: z.string().email("Invalid recipient email").optional(),
});

export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;

