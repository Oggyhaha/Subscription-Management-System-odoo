import { NextResponse } from "next/server";
import { auditQueryService } from "@/server/services/audit-query";
import { requireRole } from "@/server/auth/guards";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN");

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const action = searchParams.get("action") || undefined;
    const actor = searchParams.get("actor") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const take = parseInt(searchParams.get("take") || "25", 10);

    const [logsResult, filterOptions] = await Promise.all([
      auditQueryService.listLogs({
        entityType,
        action,
        actor,
        startDate,
        endDate,
        skip,
        take,
      }),
      auditQueryService.getFilterOptions(),
    ]);

    return NextResponse.json({
      ...logsResult,
      filterOptions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized or failed to list audit logs";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

