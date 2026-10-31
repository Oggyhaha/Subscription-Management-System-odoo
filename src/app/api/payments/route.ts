import { NextResponse } from "next/server";
import { paymentService } from "@/server/services/payment";
import { requireRole } from "@/server/auth/guards";
import type { PaymentMethod } from "@prisma/client";

export async function GET(request: Request) {
  try {
    await requireRole(["ADMIN", "STAFF"]);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const method = (searchParams.get("method") as PaymentMethod) || undefined;
    const invoiceId = searchParams.get("invoiceId") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const take = parseInt(searchParams.get("take") || "50", 10);

    const result = await paymentService.listPayments({
      search,
      method,
      invoiceId,
      customerId,
      startDate,
      endDate,
      skip,
      take,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized or failed to list payments";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

