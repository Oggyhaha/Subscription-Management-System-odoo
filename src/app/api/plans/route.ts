import { NextRequest, NextResponse } from "next/server";
import { PlanService } from "@/server/services/plan";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || undefined;
    const interval = searchParams.get("interval") as any;

    const result = await PlanService.listPlans({ page, pageSize, search, interval });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list plans" }, { status: 500 });
  }
}

