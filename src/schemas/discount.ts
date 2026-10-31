import { z } from "zod";

export const discountTypeEnum = z.enum(["PERCENTAGE", "FIXED_AMOUNT"]);
export const discountScopeEnum = z.enum(["ENTIRE_SUBSCRIPTION", "SPECIFIC_PRODUCTS"]);
export const discountStatusEnum = z.enum(["ACTIVE", "EXPIRED", "EXHAUSTED", "SCHEDULED", "INACTIVE"]);

export type DiscountType = z.infer<typeof discountTypeEnum>;
export type DiscountScope = z.infer<typeof discountScopeEnum>;
export type DiscountStatus = z.infer<typeof discountStatusEnum>;

export const discountRuleBaseSchema = z.object({
  name: z.string().trim().min(2, "Discount name must be at least 2 characters"),
  code: z
    .string()
    .trim()
    .min(2, "Discount code must be at least 2 characters")
    .regex(/^[A-Z0-9_-]+$/i, "Code must contain only alphanumeric characters, dashes, or underscores")
    .transform((val) => val.toUpperCase()),
  type: discountTypeEnum.default("PERCENTAGE"),
  scope: discountScopeEnum.default("ENTIRE_SUBSCRIPTION"),
  value: z.coerce
    .number()
    .positive("Discount value must be greater than 0"),
  minPurchaseAmount: z.coerce
    .number()
    .min(0, "Minimum purchase amount cannot be negative")
    .optional()
    .nullable(),
  minQuantity: z.coerce
    .number()
    .int("Minimum quantity must be an integer")
    .min(1, "Minimum quantity must be at least 1")
    .optional()
    .nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  maxUsageCount: z.coerce
    .number()
    .int("Max usage count must be an integer")
    .min(1, "Max usage must be at least 1")
    .optional()
    .nullable(),
  productId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const discountRuleSchema = discountRuleBaseSchema
  .refine(
    (data) => {
      if (data.type === "PERCENTAGE") {
        return data.value <= 100;
      }
      return true;
    },
    {
      message: "Percentage discount cannot exceed 100%",
      path: ["value"],
    }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      if (data.scope === "SPECIFIC_PRODUCTS") {
        return !!data.productId && data.productId.trim().length > 0;
      }
      return true;
    },
    {
      message: "A target product is required when scope is set to Specific Products",
      path: ["productId"],
    }
  );

export const discountRuleUpdateSchema = discountRuleBaseSchema.partial();

export type DiscountRuleInput = z.infer<typeof discountRuleSchema>;
export type DiscountRuleUpdateInput = z.infer<typeof discountRuleUpdateSchema>;

export const redeemDiscountSchema = z.object({
  discountId: z.string().min(1, "Discount ID is required"),
  invoiceId: z.string().optional().nullable(),
  subscriptionId: z.string().optional().nullable(),
  appliedAmount: z.coerce.number().positive("Applied amount must be positive"),
});

export type RedeemDiscountInput = z.infer<typeof redeemDiscountSchema>;

