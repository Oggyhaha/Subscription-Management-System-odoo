import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/lib/env";
import { BillingService } from "@/server/services/billing";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7).trim();
  const secret = env.CRON_SECRET;
  if (!secret || !token) return false;

  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(secret);

  if (tokenBuffer.length !== secretBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
}

export async function GET(request: Request) {
  return handleRenewalCron(request);
}

export async function POST(request: Request) {
  return handleRenewalCron(request);
}

async function handleRenewalCron(request: Request) {
  if (!verifyCronAuth(request)) {
    logger.warn("Unauthorized renewal reminder cron attempt blocked");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await BillingService.runRenewalReminders(new Date(), 14);

    return NextResponse.json({
      success: true,
      message: "Renewal reminders processed successfully",
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Renewal reminder cron execution failed", { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

