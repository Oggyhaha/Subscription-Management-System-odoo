import { z } from "zod";

export const systemSettingsSchema = z.object({
  businessName: z.string().trim().min(2, "Business name must be at least 2 characters"),
  supportEmail: z.string().trim().email("Please enter a valid support email"),
  currency: z.string().trim().min(1, "Currency code is required").max(5).default("USD"),
  currencySymbol: z.string().trim().min(1).max(5).default("₹"),
  invoiceDueDaysDefault: z.coerce
    .number()
    .int("Due days must be an integer")
    .min(0, "Due days cannot be negative")
    .max(365, "Due days cannot exceed 365")
    .default(30),
  defaultPaymentTerms: z.string().trim().min(2, "Default payment terms required").default("Net 30"),
  roundingPolicy: z.string().default("Banker's Safe ROUND_HALF_UP (2 Decimal Places)"),
  addressLine1: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  country: z.string().optional().default("US"),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;

