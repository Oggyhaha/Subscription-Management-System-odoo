import { NextRequest, NextResponse } from "next/server";
import { CustomerService } from "@/server/services/customer";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || undefined;

    const result = await CustomerService.listCustomers({ page, pageSize, search });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list customers" }, { status: 500 });
  }
}

