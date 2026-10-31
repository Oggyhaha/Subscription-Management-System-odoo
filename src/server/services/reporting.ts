import Decimal from "decimal.js";
import { db } from "@/server/db";
import { toDecimal, roundMoney, addMoney } from "@/lib/money";
import type { BillingInterval, SubscriptionStatus } from "@prisma/client";

export interface DashboardFilterParams {
  startDate?: Date | string;
  endDate?: Date | string;
}

export interface RevenueTrendPoint {
  period: string;
  invoiced: number;
  collected: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
}

export interface PlanDistributionItem {
  planName: string;
  count: number;
  mrr: number;
}

/**
 * MRR CALCULATION METHODOLOGY (Industry-Standard Normalized Formula):
 * Normalizes all recurring subscription revenues into a standardized monthly equivalent:
 * - MONTHLY: totalAmount * 1.0
 * - YEARLY:  totalAmount / 12.0
 * - WEEKLY:  (totalAmount * 52.0) / 12.0
 * - DAILY:   (totalAmount * 365.0) / 12.0  (~30.4167 days/month)
 *
 * Subscriptions in DRAFT, QUOTATION, PAUSED, or CLOSED state are excluded from active MRR.
 */
export function calculateSubscriptionMrr(
  amount: Decimal | number | string,
  interval: BillingInterval
): Decimal {
  const dec = toDecimal(amount);
  if (dec.lte(0)) return new Decimal(0);

  switch (interval) {
    case "MONTHLY":
      return roundMoney(dec);
    case "YEARLY":
      return roundMoney(dec.dividedBy(12));
    case "WEEKLY":
      return roundMoney(dec.times(52).dividedBy(12));
    case "DAILY":
      return roundMoney(dec.times(365).dividedBy(12));
    default:
      return roundMoney(dec);
  }
}

export class ReportingService {
  /**
   * Retrieves comprehensive executive metrics and trends using real DB aggregations
   */
  async getDashboardMetrics(filters?: DashboardFilterParams) {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const start = filters?.startDate ? new Date(filters.startDate) : undefined;
    const end = filters?.endDate ? new Date(filters.endDate) : undefined;

    const [
      activeSubscriptions,
      newSubscriptionsCount,
      invoicedAgg,
      collectedAgg,
      outstandingAgg,
      overdueAgg,
      upcomingRenewals,
      recentPayments,
      statusBreakdownRaw,
      allActiveSubsForMrr,
      allPlansWithSubs,
    ] = await Promise.all([
      // 1. Total active subscriptions
      db.subscription.count({
        where: { status: "ACTIVE" },
      }),

      // 2. New subscriptions in period
      db.subscription.count({
        where: {
          ...(start || end
            ? {
                createdAt: {
                  ...(start && { gte: start }),
                  ...(end && { lte: end }),
                },
              }
            : {}),
        },
      }),

      // 3. Invoiced amount (excluding cancelled)
      db.invoice.aggregate({
        _sum: { totalAmount: true },
        where: {
          status: { not: "CANCELLED" },
          ...(start || end
            ? {
                issueDate: {
                  ...(start && { gte: start }),
                  ...(end && { lte: end }),
                },
              }
            : {}),
        },
      }),

      // 4. Cash collected from payments table ONLY (Never conflate invoice totals with cash!)
      db.payment.aggregate({
        _sum: { amount: true },
        where: {
          ...(start || end
            ? {
                paymentDate: {
                  ...(start && { gte: start }),
                  ...(end && { lte: end }),
                },
              }
            : {}),
        },
      }),

      // 5. Total outstanding receivables
      db.invoice.aggregate({
        _sum: { amountDue: true },
        where: {
          status: "CONFIRMED",
          amountDue: { gt: 0 },
        },
      }),

      // 6. Overdue invoices (Confirmed, balance > 0, dueDate < now)
      db.invoice.aggregate({
        _sum: { amountDue: true },
        _count: { id: true },
        where: {
          status: "CONFIRMED",
          amountDue: { gt: 0 },
          dueDate: { lt: now },
        },
      }),

      // 7. Upcoming renewals in next 30 days
      db.subscription.findMany({
        where: {
          status: "ACTIVE",
          nextBillingDate: {
            gte: now,
            lte: in30Days,
          },
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          plan: { select: { id: true, name: true } },
        },
        orderBy: { nextBillingDate: "asc" },
        take: 8,
      }),

      // 8. Recent payments
      db.payment.findMany({
        include: {
          customer: { select: { id: true, name: true, email: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { paymentDate: "desc" },
        take: 8,
      }),

      // 9. Subscription status breakdown
      db.subscription.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // 10. All active subscriptions for accurate normalized MRR calculation
      db.subscription.findMany({
        where: { status: "ACTIVE" },
        select: {
          totalAmount: true,
          billingInterval: true,
          planId: true,
        },
      }),

      // 11. Plans for distribution
      db.plan.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { subscriptions: true } },
        },
      }),
    ]);

    // Compute normalized MRR
    let totalMrr = new Decimal(0);
    const planMrrMap: Record<string, Decimal> = {};

    for (const sub of allActiveSubsForMrr) {
      const subMrr = calculateSubscriptionMrr(sub.totalAmount, sub.billingInterval);
      totalMrr = totalMrr.plus(subMrr);
      planMrrMap[sub.planId] = (planMrrMap[sub.planId] || new Decimal(0)).plus(subMrr);
    }

    const planDistribution: PlanDistributionItem[] = allPlansWithSubs.map((p) => ({
      planName: p.name,
      count: p._count.subscriptions,
      mrr: (planMrrMap[p.id] || new Decimal(0)).toNumber(),
    }));

    // Status breakdown array
    const statusBreakdown: StatusBreakdownItem[] = statusBreakdownRaw.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    // Revenue trend (last 6 months or filtered range)
    const revenueTrend = await this.getRevenueTrend(start, end);

    return {
      activeSubscriptionsCount: activeSubscriptions,
      newSubscriptionsCount,
      totalMrr: roundMoney(totalMrr).toNumber(),
      totalInvoiced: roundMoney(invoicedAgg._sum.totalAmount || 0).toNumber(),
      totalCollected: roundMoney(collectedAgg._sum.amount || 0).toNumber(),
      totalOutstanding: roundMoney(outstandingAgg._sum.amountDue || 0).toNumber(),
      overdueAmount: roundMoney(overdueAgg._sum.amountDue || 0).toNumber(),
      overdueCount: overdueAgg._count.id || 0,
      upcomingRenewals: upcomingRenewals.map((r) => ({
        ...r,
        totalAmount: toDecimal(r.totalAmount).toNumber(),
      })),
      recentPayments: recentPayments.map((p) => ({
        ...p,
        amount: toDecimal(p.amount).toNumber(),
      })),
      statusBreakdown,
      planDistribution,
      revenueTrend,
    };
  }

  /**
   * Generates chronological revenue trend points (Invoiced vs Collected)
   */
  async getRevenueTrend(start?: Date, end?: Date): Promise<RevenueTrendPoint[]> {
    const defaultStart = start || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 6 months ago
    const defaultEnd = end || new Date();

    const [invoices, payments] = await Promise.all([
      db.invoice.findMany({
        where: {
          status: { not: "CANCELLED" },
          issueDate: { gte: defaultStart, lte: defaultEnd },
        },
        select: { issueDate: true, totalAmount: true },
      }),
      db.payment.findMany({
        where: {
          paymentDate: { gte: defaultStart, lte: defaultEnd },
        },
        select: { paymentDate: true, amount: true },
      }),
    ]);

    // Bucket by Month (YYYY-MM)
    const bucketMap: Record<string, { invoiced: Decimal; collected: Decimal }> = {};

    for (const inv of invoices) {
      const monthKey = inv.issueDate.toISOString().slice(0, 7); // YYYY-MM
      if (!bucketMap[monthKey]) {
        bucketMap[monthKey] = { invoiced: new Decimal(0), collected: new Decimal(0) };
      }
      bucketMap[monthKey].invoiced = bucketMap[monthKey].invoiced.plus(toDecimal(inv.totalAmount));
    }

    for (const pay of payments) {
      const monthKey = pay.paymentDate.toISOString().slice(0, 7);
      if (!bucketMap[monthKey]) {
        bucketMap[monthKey] = { invoiced: new Decimal(0), collected: new Decimal(0) };
      }
      bucketMap[monthKey].collected = bucketMap[monthKey].collected.plus(toDecimal(pay.amount));
    }

    const sortedKeys = Object.keys(bucketMap).sort();
    return sortedKeys.map((key) => ({
      period: key,
      invoiced: roundMoney(bucketMap[key].invoiced).toNumber(),
      collected: roundMoney(bucketMap[key].collected).toNumber(),
    }));
  }

  /**
   * Staff Operations Dashboard Metrics
   * Focused on daily execution: overdue, due today, pending quotes, uncollected balances
   */
  async getStaffOperationsMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [
      outstandingInvoices,
      overdueInvoices,
      dueTodayInvoices,
      recentQuotations,
    ] = await Promise.all([
      // Outstanding
      db.invoice.findMany({
        where: { status: "CONFIRMED", amountDue: { gt: 0 } },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),

      // Overdue
      db.invoice.findMany({
        where: { status: "CONFIRMED", amountDue: { gt: 0 }, dueDate: { lt: todayStart } },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),

      // Due Today
      db.invoice.findMany({
        where: {
          status: "CONFIRMED",
          amountDue: { gt: 0 },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
      }),

      // Recent Quotations
      db.quotation.findMany({
        include: {
          customer: { select: { id: true, name: true } },
          plan: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    const totalOutstandingSum = outstandingInvoices.reduce<Decimal>(
      (acc, inv) => acc.plus(toDecimal(inv.amountDue)),
      new Decimal(0)
    );

    const totalOverdueSum = overdueInvoices.reduce<Decimal>(
      (acc, inv) => acc.plus(toDecimal(inv.amountDue)),
      new Decimal(0)
    );

    return {
      totalOutstandingAmount: roundMoney(totalOutstandingSum).toNumber(),
      outstandingCount: outstandingInvoices.length,
      totalOverdueAmount: roundMoney(totalOverdueSum).toNumber(),
      overdueCount: overdueInvoices.length,
      dueTodayCount: dueTodayInvoices.length,
      dueTodayInvoices: dueTodayInvoices.map((i) => ({
        ...i,
        amountDue: toDecimal(i.amountDue).toNumber(),
        totalAmount: toDecimal(i.totalAmount).toNumber(),
      })),
      overdueInvoices: overdueInvoices.map((i) => ({
        ...i,
        amountDue: toDecimal(i.amountDue).toNumber(),
        totalAmount: toDecimal(i.totalAmount).toNumber(),
      })),
      recentQuotations: recentQuotations.map((q) => ({
        ...q,
        totalAmount: toDecimal(q.totalAmount).toNumber(),
      })),
    };
  }

  /**
   * Generates Revenue Report CSV content
   */
  async exportRevenueCsv(): Promise<string> {
    const trend = await this.getRevenueTrend();
    let csv = "Period,Invoiced Amount,Collected Cash,Net Uncollected\n";
    for (const row of trend) {
      const net = (row.invoiced - row.collected).toFixed(2);
      csv += `${row.period},${row.invoiced.toFixed(2)},${row.collected.toFixed(2)},${net}\n`;
    }
    return csv;
  }

  /**
   * Generates Aging Receivables CSV content
   */
  async exportAgingCsv(): Promise<string> {
    const invoices = await db.invoice.findMany({
      where: { status: "CONFIRMED", amountDue: { gt: 0 } },
      include: { customer: { select: { name: true, email: true } } },
      orderBy: { dueDate: "asc" },
    });

    const now = new Date();
    let csv = "Invoice Number,Customer Name,Customer Email,Issue Date,Due Date,Days Overdue,Amount Due\n";

    for (const inv of invoices) {
      const dueTime = new Date(inv.dueDate).getTime();
      const diffDays = Math.max(0, Math.floor((now.getTime() - dueTime) / (1000 * 60 * 60 * 24)));
      csv += `"${inv.invoiceNumber}","${inv.customer.name}","${inv.customer.email}",${inv.issueDate.toISOString().slice(0, 10)},${inv.dueDate.toISOString().slice(0, 10)},${diffDays},${toDecimal(inv.amountDue).toFixed(2)}\n`;
    }

    return csv;
  }

  /**
   * Generates Subscriptions CSV content
   */
  async exportSubscriptionsCsv(): Promise<string> {
    const subscriptions = await db.subscription.findMany({
      include: {
        customer: { select: { name: true, email: true } },
        plan: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let csv = "Subscription Number,Customer,Plan,Status,Interval,Current Period End,Next Billing Date,Cycle Total,Normalized MRR\n";

    for (const sub of subscriptions) {
      const mrr = sub.status === "ACTIVE"
        ? calculateSubscriptionMrr(sub.totalAmount, sub.billingInterval).toFixed(2)
        : "0.00";

      csv += `"${sub.subscriptionNumber}","${sub.customer.name}","${sub.plan.name}",${sub.status},${sub.billingInterval},${sub.currentPeriodEnd.toISOString().slice(0, 10)},${sub.nextBillingDate ? sub.nextBillingDate.toISOString().slice(0, 10) : "N/A"},${toDecimal(sub.totalAmount).toFixed(2)},${mrr}\n`;
    }

    return csv;
  }
}

export const reportingService = new ReportingService();

