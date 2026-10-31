import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { attributeValue: { contains: search, mode: "insensitive" } },
      ];
    }

    const variants = await db.productVariant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { id: true, name: true, salesPrice: true },
        },
      },
    });

    return NextResponse.json({ data: variants });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to list variants" }, { status: 500 });
  }
}

