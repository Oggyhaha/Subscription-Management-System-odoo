import { z } from "zod";

export const paymentMethodEnum = z.enum([
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "ACH",
  "CASH",
  "CHECK",
  "OTHER",
]);

export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.coerce
    .number()
    .positive("Payment amount must be greater than zero"),
  paymentMethod: paymentMethodEnum.default("BANK_TRANSFER"),
  paymentDate: z.coerce.date().default(() => new Date()),
  referenceNote: z
    .string()
    .trim()
    .max(255, "Reference note cannot exceed 255 characters")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters")
    .optional()
    .nullable(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

