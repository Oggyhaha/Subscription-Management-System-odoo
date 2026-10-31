import { NextRequest, NextResponse } from "next/server";
import { ProductService } from "@/server/services/product";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || undefined;

    const result = await ProductService.listProducts({ page, pageSize, search });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list products" }, { status: 500 });
  }
}

