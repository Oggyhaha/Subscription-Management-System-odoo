import { z } from "zod";

export const ProductTypeEnum = z.enum(["SOFTWARE", "SERVICE", "HARDWARE", "CONSUMABLE"]);
export type ProductType = z.infer<typeof ProductTypeEnum>;

export const BillingIntervalEnum = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
export type BillingInterval = z.infer<typeof BillingIntervalEnum>;

// ==========================================
// Product Schemas
// ==========================================

export const productSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  type: ProductTypeEnum.default("SOFTWARE"),
  salesPrice: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Sales price must be positive or zero"),
  costPrice: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Cost price must be positive or zero"),
  notes: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export const productVariantSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  name: z.string().trim().min(1, "Variant name is required"),
  sku: z.string().trim().optional().nullable(),
  priceModifier: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)), "Price modifier must be a valid number")
    .default(0),
  attributeName: z.string().trim().min(1, "Attribute name is required (e.g., Edition, Tier)"),
  attributeValue: z.string().trim().min(1, "Attribute value is required (e.g., Enterprise, Standard)"),
  isActive: z.boolean().default(true),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

// ==========================================
// Plan Schemas
// ==========================================

export const planProductItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").default(1),
  isOptional: z.boolean().default(false),
});

export const planBaseSchema = z.object({
  name: z.string().trim().min(2, "Plan name must be at least 2 characters"),
  code: z
    .string()
    .trim()
    .min(2, "Plan code must be at least 2 characters")
    .regex(/^[A-Z0-9-_]+$/i, "Code can only contain alphanumeric characters, hyphens, and underscores"),
  description: z.string().trim().optional().nullable(),
  price: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Plan price must be positive or zero"),
  billingInterval: BillingIntervalEnum.default("MONTHLY"),
  minQuantity: z.number().int().min(1, "Minimum quantity must be at least 1").default(1),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  autoCloseAtEnd: z.boolean().default(false),
  allowEarlyClose: z.boolean().default(true),
  allowPause: z.boolean().default(true),
  allowRenewal: z.boolean().default(true),
  isActive: z.boolean().default(true),
  products: z.array(planProductItemSchema).optional().default([]),
});

export const planSchema = planBaseSchema.refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate);
    }
    return true;
  },
  {
    message: "End date must be on or after start date",
    path: ["endDate"],
  }
);

export const planUpdateSchema = planBaseSchema.partial();

export type PlanInput = z.infer<typeof planSchema>;

// ==========================================
// Tax Rule Schemas
// ==========================================

export const taxRuleSchema = z.object({
  name: z.string().trim().min(2, "Tax name must be at least 2 characters"),
  rate: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Tax rate must be positive or zero"),
  isInclusive: z.boolean().default(false),
  country: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type TaxRuleInput = z.infer<typeof taxRuleSchema>;

// ==========================================
// Customer Profile Schemas
// ==========================================

export const customerProfileSchema = z.object({
  name: z.string().trim().min(2, "Customer or business name must be at least 2 characters"),
  email: z.string().trim().email("Please enter a valid email address"),
  phone: z.string().trim().optional().nullable(),
  addressLine1: z.string().trim().optional().nullable(),
  addressLine2: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  postalCode: z.string().trim().optional().nullable(),
  country: z.string().trim().default("US"),
  taxIdentifier: z.string().trim().optional().nullable(),
  userId: z.string().optional().nullable(),
});

export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;
