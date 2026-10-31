import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  CRON_SECRET: z.string().min(8, "CRON_SECRET is required"),

  // SMTP Settings
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM_EMAIL: z.string().email().default("billing@brightloop.com"),
  SMTP_FROM_NAME: z.string().default("Brightloop Software Billing"),

  // Application
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // In build or test environments without runtime secrets, provide safe fallback
  if (process.env.NODE_ENV === "test") {
    return {
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/subscription_db",
      AUTH_SECRET: process.env.AUTH_SECRET || "test-secret-at-least-16-characters-long",
      CRON_SECRET: process.env.CRON_SECRET || "test-cron-secret",
      SMTP_HOST: "localhost",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: "",
      SMTP_PASS: "",
      SMTP_FROM_EMAIL: "billing@brightloop.com",
      SMTP_FROM_NAME: "Brightloop Software Billing",
      APP_URL: "http://localhost:3000",
    };
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 2));
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = validateEnv();

