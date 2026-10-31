import { z } from "zod";

export const subscriptionItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  productVariantId: z.string().nullable().optional(),
  taxRuleId: z.string().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  taxAmount: z.coerce.number().min(0).optional().default(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
});

export type SubscriptionItemInput = z.infer<typeof subscriptionItemInputSchema>;

export const createSubscriptionSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  planId: z.string().min(1, "Plan is required"),
  quotationId: z.string().nullable().optional(),
  startDate: z.string().or(z.date()).default(() => new Date().toISOString()),
  expiryDate: z.string().or(z.date()).nullable().optional(),
  paymentTerms: z.string().default("Net 30"),
  billingInterval: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  autoCloseAtEnd: z.boolean().default(false),
  allowEarlyClose: z.boolean().default(true),
  allowPause: z.boolean().default(true),
  allowRenewal: z.boolean().default(true),
  notes: z.string().trim().nullable().optional(),
  items: z.array(subscriptionItemInputSchema).min(1, "At least one item is required"),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const subscriptionActionSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription ID is required"),
  action: z.enum(["CONFIRM", "ACTIVATE", "PAUSE", "RESUME", "RENEW", "CLOSE"]),
  reason: z.string().trim().nullable().optional(),
});

export type SubscriptionActionInput = z.infer<typeof subscriptionActionSchema>;

