import { z } from "zod";

export const quotationTemplateItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, "Product is required"),
  productVariantId: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
});

export type QuotationTemplateItemInput = z.infer<typeof quotationTemplateItemSchema>;

export const createQuotationTemplateSchema = z.object({
  name: z.string().trim().min(2, "Template name must be at least 2 characters"),
  planId: z.string().nullable().optional(),
  validityDays: z.coerce.number().int().min(1, "Validity days must be at least 1").default(30),
  notes: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
  items: z.array(quotationTemplateItemSchema).min(1, "At least one product line is required"),
});

export type CreateQuotationTemplateInput = z.infer<typeof createQuotationTemplateSchema>;

export const quotationItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  productVariantId: z.string().nullable().optional(),
  taxRuleId: z.string().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  taxAmount: z.coerce.number().min(0).optional().default(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
});

export type QuotationItemInput = z.infer<typeof quotationItemInputSchema>;

export const createQuotationSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  planId: z.string().min(1, "Plan is required"),
  templateId: z.string().nullable().optional(),
  validUntil: z.string().or(z.date()),
  paymentTerms: z.string().default("Net 30"),
  notes: z.string().trim().nullable().optional(),
  items: z.array(quotationItemInputSchema).min(1, "At least one line item is required"),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

export const generateFromTemplateSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  customerId: z.string().min(1, "Customer ID is required"),
  customValidityDays: z.coerce.number().int().min(1).optional(),
});

export type GenerateFromTemplateInput = z.infer<typeof generateFromTemplateSchema>;

export const sendQuotationSchema = z.object({
  quotationId: z.string().min(1, "Quotation ID is required"),
  recipientEmail: z.string().email().optional(),
});

export type SendQuotationInput = z.infer<typeof sendQuotationSchema>;

