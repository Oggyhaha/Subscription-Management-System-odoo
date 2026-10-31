import { PrismaClient } from "@prisma/client";
import { ReportingService } from "../../src/server/services/reporting";

const prisma = new PrismaClient();
const reportingService = new ReportingService();

interface BenchmarkResult {
  operation: string;
  queryDescription: string;
  latencyMs: number;
  recordsEvaluated: number;
  targetLatencyMs: number;
  status: "PASS" | "WARN" | "FAIL";
}

async function benchmark(
  name: string,
  desc: string,
  fn: () => Promise<number>,
  targetMs = 2000
): Promise<BenchmarkResult> {
  const start = performance.now();
  const count = await fn();
  const duration = performance.now() - start;
  const roundedMs = Math.round(duration * 100) / 100;

  return {
    operation: name,
    queryDescription: desc,
    latencyMs: roundedMs,
    recordsEvaluated: count,
    targetLatencyMs: targetMs,
    status: roundedMs < targetMs ? "PASS" : "FAIL",
  };
}

export async function runPerformanceBenchmarks(): Promise<BenchmarkResult[]> {
  console.log("===============================================================");
  console.log("⚡ Brightloop Software — Production Query Performance Benchmark");
  console.log("   SLA Target: Under 2,000 ms (< 2.0s) per query");
  console.log("===============================================================\n");

  const results: BenchmarkResult[] = [];

  try {
    // 1. Executive Dashboard Multi-Dimensional Aggregation
    results.push(
      await benchmark(
        "Admin Executive Dashboard",
        "Single-pass Promise.all aggregations (MRR, cash collected, invoiced, overdue)",
        async () => {
          const metrics = await reportingService.getDashboardMetrics();
          return (
            metrics.activeSubscriptionsCount +
            metrics.statusBreakdown.reduce((a, b) => a + b.count, 0)
          );
        }
      )
    );

    // 2. Subscriptions List with Pagination & Status Filtering
    results.push(
      await benchmark(
        "Subscriptions List Query",
        "Indexed filter on status: ACTIVE with customer and plan join, ordered by nextBillingDate",
        async () => {
          const subs = await prisma.subscription.findMany({
            where: { status: "ACTIVE" },
            include: {
              customer: { select: { id: true, name: true, email: true } },
              plan: { select: { id: true, name: true, billingInterval: true } },
            },
            orderBy: { nextBillingDate: "asc" },
            take: 50,
          });
          return subs.length;
        }
      )
    );

    // 3. Invoices Ledger Query with Overdue Filtering
    results.push(
      await benchmark(
        "Invoices Aging & Overdue Ledger",
        "Indexed filter on status: CONFIRMED, amountDue > 0, dueDate < now with customer join",
        async () => {
          const invoices = await prisma.invoice.findMany({
            where: { status: "CONFIRMED", amountDue: { gt: 0 } },
            include: { customer: { select: { id: true, name: true } } },
            orderBy: { dueDate: "asc" },
            take: 50,
          });
          return invoices.length;
        }
      )
    );

    // 4. Payments Stream Ledger
    results.push(
      await benchmark(
        "Payments Stream Ledger",
        "Chronological payment stream join across invoices and customers",
        async () => {
          const payments = await prisma.payment.findMany({
            include: {
              customer: { select: { id: true, name: true, email: true } },
              invoice: { select: { id: true, invoiceNumber: true } },
            },
            orderBy: { paymentDate: "desc" },
            take: 50,
          });
          return payments.length;
        }
      )
    );

    // 5. Staff Operations Dashboard
    results.push(
      await benchmark(
        "Staff Operations Dashboard",
        "Real-time due today, overdue queue, and pending quotations aggregation",
        async () => {
          const ops = await reportingService.getStaffOperationsMetrics();
          return ops.outstandingCount + ops.overdueCount + ops.dueTodayCount;
        }
      )
    );

    // 6. Chronological Revenue Trend
    results.push(
      await benchmark(
        "Revenue Trend Time-Series",
        "Historical 6-month invoice billing vs verified cash collections grouping",
        async () => {
          const trend = await reportingService.getRevenueTrend();
          return trend.length;
        }
      )
    );

    // 7. Customer Portal Multi-Tenant Isolation
    results.push(
      await benchmark(
        "Customer Portal Isolation",
        "Customer-scoped query across active contracts and uncollected invoices",
        async () => {
          const firstCustomer = await prisma.customerProfile.findFirst({ select: { id: true } });
          if (!firstCustomer) return 0;

          const [customerSubs, customerInvoices] = await Promise.all([
            prisma.subscription.findMany({
              where: { customerId: firstCustomer.id },
              include: { plan: true },
            }),
            prisma.invoice.findMany({
              where: { customerId: firstCustomer.id },
            }),
          ]);
          return customerSubs.length + customerInvoices.length;
        }
      )
    );

    console.table(
      results.map((r) => ({
        "Operation": r.operation,
        "Latency (ms)": `${r.latencyMs} ms`,
        "SLA Target": `< ${r.targetLatencyMs} ms`,
        "SLA Met": r.status === "PASS" ? "✅ YES" : "❌ NO",
      }))
    );

    return results;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runPerformanceBenchmarks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Benchmark runner error:", err);
      process.exit(1);
    });
}

