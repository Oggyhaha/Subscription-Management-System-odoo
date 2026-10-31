import { NextResponse } from "next/server";
import { discountService } from "@/server/services/discount";
import { requireRole } from "@/server/auth/guards";
import type { DiscountScope, DiscountType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    await requireRole(["ADMIN", "STAFF"]);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const scope = (searchParams.get("scope") as DiscountScope) || undefined;
    const type = (searchParams.get("type") as DiscountType) || undefined;
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const take = parseInt(searchParams.get("take") || "50", 10);

    const result = await discountService.listDiscounts({
      search,
      scope,
      type,
      skip,
      take,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized or failed to list discounts";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

