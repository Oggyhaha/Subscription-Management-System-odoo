import { NextRequest, NextResponse } from "next/server";
import { TaxService } from "@/server/services/tax";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || undefined;

    const result = await TaxService.listTaxRules({ page, pageSize, search });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list tax rules" }, { status: 500 });
  }
}

