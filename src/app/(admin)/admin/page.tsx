import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatMoney } from "@/lib/money";
import { reportingService } from "@/server/services/reporting";
import { requireRole } from "@/server/auth/guards";
import {
  TrendingUp,
  CreditCard,
  Receipt,
  AlertTriangle,
  Repeat,
  DollarSign,
  Download,
  Info,
} from "lucide-react";
import {
  RevenueTrendChart,
  SubscriptionStatusChart,
  PlanDistributionChart,
} from "@/components/charts";
import {
  UpcomingRenewalsTable,
  RecentPaymentsTable,
} from "@/components/dashboard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{
    period?: string;
  }>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/login?callbackUrl=/admin");
  }
  const { period = "all" } = await searchParams;

  const now = new Date();
  let startDate: Date | undefined;

  if (period === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === "90d") {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (period === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
  }

  const metrics = await reportingService.getDashboardMetrics({
    startDate,
    endDate: now,
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Executive Dashboard"
        description="Global subscription performance, normalized MRR, and verified cash collections"
        actions={
          <div className="flex items-center gap-2">
            {/* Period Filters */}
            <div className="inline-flex rounded-lg border border-rule bg-paper-2 p-1 text-xs font-medium">
              {[
                { key: "30d", label: "30 Days" },
                { key: "90d", label: "90 Days" },
                { key: "year", label: "YTD" },
                { key: "all", label: "All Time" },
              ].map((tab) => {
                const isActive = period === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={`/admin?period=${tab.key}`}
                    className={cn(
                      "px-3 py-1 rounded-md transition-colors",
                      isActive
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            <Link
              href="/admin/reports"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <Download className="h-3.5 w-3.5" />
              Reports &amp; CSV
            </Link>
          </div>
        }
      />

      <div className="px-6 space-y-6">
        {/* MRR Calculation Banner Note */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Normalized MRR Methodology:</span>{" "}
            Monthly Recurring Revenue standardizes billing cycles: Yearly plans are normalized to (/12), Weekly plans to (x52/12), and Daily plans to (x365/12). Only Active subscriptions contribute to MRR. Cash Collected reflects verified payments in the bank, strictly segregated from invoiced receivables.
          </div>
        </div>

        {/* Top KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            title="Monthly Recurring (MRR)"
            value={formatMoney(metrics.totalMrr)}
            subtitle="Normalized active run-rate"
            icon={TrendingUp}
          />
          <KpiCard
            title="Cash Collected"
            value={formatMoney(metrics.totalCollected)}
            subtitle="Real receipts in payments table"
            icon={DollarSign}
          />
          <KpiCard
            title="Total Invoiced"
            value={formatMoney(metrics.totalInvoiced)}
            subtitle="Total billed receivables"
            icon={Receipt}
          />
          <KpiCard
            title="Outstanding Balance"
            value={formatMoney(metrics.totalOutstanding)}
            subtitle="Confirmed uncollected balance"
            icon={CreditCard}
          />
          <KpiCard
            title="Overdue Receivables"
            value={formatMoney(metrics.overdueAmount)}
            subtitle={`${metrics.overdueCount} overdue invoice${metrics.overdueCount === 1 ? "" : "s"}`}
            icon={AlertTriangle}
          />
          <KpiCard
            title="Active Subscriptions"
            value={metrics.activeSubscriptionsCount}
            subtitle={`${metrics.newSubscriptionsCount} created in period`}
            icon={Repeat}
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue Trend: 2 columns */}
          <div className="lg:col-span-2 rounded-lg border border-rule bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Revenue Trend (Invoiced vs Cash Collected)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Billed receivables compared against verified bank deposits
                </p>
              </div>
            </div>
            <RevenueTrendChart data={metrics.revenueTrend} />
          </div>

          {/* Status Breakdown Donut: 1 column */}
          <div className="rounded-lg border border-rule bg-card p-5">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-foreground">
                Subscription Lifecycle
              </h3>
              <p className="text-xs text-muted-foreground">
                Distribution across lifecycle stages
              </p>
            </div>
            <SubscriptionStatusChart data={metrics.statusBreakdown} />
          </div>
        </div>

        {/* Plan Distribution & Upcoming Renewals */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Plan Distribution */}
          <div className="rounded-lg border border-rule bg-card p-5">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-foreground">
                MRR Contribution by Plan
              </h3>
              <p className="text-xs text-muted-foreground">
                Total monthly recurring revenue generated per subscription tier
              </p>
            </div>
            <PlanDistributionChart data={metrics.planDistribution} />
          </div>

          {/* Upcoming Renewals */}
          <div className="rounded-lg border border-rule bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Upcoming Renewals (Next 30 Days)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Subscriptions approaching automatic renewal
                </p>
              </div>
              <Link
                href="/admin/subscriptions"
                className="text-xs text-primary hover:underline font-medium"
              >
                View all
              </Link>
            </div>
            <UpcomingRenewalsTable renewals={metrics.upcomingRenewals} />
          </div>
        </div>

        {/* Recent Payments Stream */}
        <div className="rounded-lg border border-rule bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Recent Cash Receipts
              </h3>
              <p className="text-xs text-muted-foreground">
                Latest customer payments logged across all channels
              </p>
            </div>
            <Link
              href="/admin/payments"
              className="text-xs text-primary hover:underline font-medium"
            >
              View ledger
            </Link>
          </div>
          <RecentPaymentsTable payments={metrics.recentPayments} />
        </div>
      </div>
    </div>
  );
}
