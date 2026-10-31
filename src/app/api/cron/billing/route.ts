import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/lib/env";
import { BillingService } from "@/server/services/billing";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Constant-time comparison of Authorization Bearer header against CRON_SECRET
 */
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
  return handleBillingCron(request);
}

export async function POST(request: Request) {
  return handleBillingCron(request);
}

async function handleBillingCron(request: Request) {
  if (!verifyCronAuth(request)) {
    logger.warn("Unauthorized billing cron attempt blocked");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await BillingService.runDueBilling(new Date(), {
      triggeredBy: "CRON_SYSTEM",
    });

    return NextResponse.json({
      success: true,
      message: "Automated billing run completed successfully",
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown billing error";
    logger.error("Billing cron execution failed", { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

