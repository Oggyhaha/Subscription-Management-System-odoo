import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

let cachedTransporter: nodemailer.Transporter | null = null;

export async function getMailerTransport(): Promise<nodemailer.Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // If local development without real credentials, check if we should create a test/stream transport or connect to Mailpit/Ethereal
  if (
    process.env.NODE_ENV === "development" &&
    (!env.SMTP_USER || env.SMTP_HOST === "localhost" || env.SMTP_HOST === "smtp.example.com")
  ) {
    logger.info("Using Nodemailer JSON transport for local dev (logs to stdout/db without external SMTP)");
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return cachedTransporter;
  }

  const transportConfig: nodemailer.TransportOptions = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  } as unknown as nodemailer.TransportOptions;

  cachedTransporter = nodemailer.createTransport(transportConfig);

  return cachedTransporter;
}

export function getSenderAddress(): string {
  return `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`;
}

