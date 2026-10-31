import { NextResponse } from "next/server";
import { reportingService } from "@/server/services/reporting";
import { requireRole } from "@/server/auth/guards";

export async function GET(request: Request) {
  try {
    await requireRole(["ADMIN"]);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const metrics = await reportingService.getDashboardMetrics({ startDate, endDate });
    return NextResponse.json(metrics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized or error loading metrics";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

