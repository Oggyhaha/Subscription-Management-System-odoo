import { NextResponse } from "next/server";
import { paymentService } from "@/server/services/payment";
import { requireRole } from "@/server/auth/guards";

export async function GET(request: Request) {
  try {
    await requireRole(["ADMIN", "STAFF"]);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const take = parseInt(searchParams.get("take") || "50", 10);

    const [invoicesResult, metricsResult] = await Promise.all([
      paymentService.getOutstandingInvoices({ search, customerId, skip, take }),
      paymentService.getAgingMetrics(),
    ]);

    return NextResponse.json({
      invoices: invoicesResult.invoices,
      total: invoicesResult.total,
      metrics: {
        current: { count: metricsResult.current.count, totalAmount: metricsResult.current.totalAmount.toNumber() },
        days1To30: { count: metricsResult.days1To30.count, totalAmount: metricsResult.days1To30.totalAmount.toNumber() },
        days31To60: { count: metricsResult.days31To60.count, totalAmount: metricsResult.days31To60.totalAmount.toNumber() },
        days61To90: { count: metricsResult.days61To90.count, totalAmount: metricsResult.days61To90.totalAmount.toNumber() },
        days90Plus: { count: metricsResult.days90Plus.count, totalAmount: metricsResult.days90Plus.totalAmount.toNumber() },
        totalOutstanding: metricsResult.totalOutstanding.toNumber(),
        totalOverdue: metricsResult.totalOverdue.toNumber(),
        totalInvoicesCount: metricsResult.totalInvoicesCount,
        overdueInvoicesCount: metricsResult.overdueInvoicesCount,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized or failed to load outstanding invoices";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

