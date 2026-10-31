import { NextResponse } from "next/server";
import { reportingService } from "@/server/services/reporting";
import { requireRole } from "@/server/auth/guards";

export async function GET() {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const csv = await reportingService.exportAgingCsv();

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="brightloop-receivables-aging-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

