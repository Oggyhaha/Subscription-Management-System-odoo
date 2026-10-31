import { NextResponse } from "next/server";
import { reportingService } from "@/server/services/reporting";
import { requireRole } from "@/server/auth/guards";

export async function GET() {
  try {
    await requireRole(["ADMIN", "STAFF"]);

    const metrics = await reportingService.getStaffOperationsMetrics();
    return NextResponse.json(metrics);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized or error loading staff metrics";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

