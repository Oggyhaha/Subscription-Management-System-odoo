import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatMoney } from "@/lib/money";
import { reportingService } from "@/server/services/reporting";
import { requireRole } from "@/server/auth/guards";
import { Download, FileText, Calendar, DollarSign, Repeat, ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ReportsPage() {
  await requireRole(["ADMIN"]);

  const metrics = await reportingService.getDashboardMetrics();

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Financial &amp; Subscription Reports"
        description="Audit-grade revenue summaries, receivables aging schedules, and subscriber distributions with one-click CSV export"
      />

      <div className="px-6 space-y-8 max-w-6xl">
        {/* Report 1: Revenue & Cash Collected */}
        <div className="rounded-lg border border-rule bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Revenue &amp; Cash Collection Report
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Detailed transaction reconciliation distinguishing invoiced receivables from verified bank cash deposits.
              </p>
            </div>
            <a
              href="/api/reports/revenue/export"
              download="revenue_report.csv"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 self-start sm:self-auto")}
            >
              <Download className="h-4 w-4" />
              Export Revenue CSV
            </a>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-rule bg-paper-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">Total Invoiced Receivables</span>
              <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {formatMoney(metrics.totalInvoiced)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Across all confirmed non-cancelled invoices</p>
            </div>

            <div className="rounded-md border border-rule bg-paper-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">Cash Collected in Bank</span>
              <div className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(metrics.totalCollected)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Verified cash receipts in payments table</p>
            </div>

            <div className="rounded-md border border-rule bg-paper-2 p-4">
              <span className="text-xs font-medium text-muted-foreground">Net Uncollected Balance</span>
              <div className="mt-1 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatMoney(metrics.totalOutstanding)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Pending customer settlement</p>
            </div>
          </div>
        </div>

        {/* Report 2: Aging Receivables Report */}
        <div className="rounded-lg border border-rule bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-500" />
                Accounts Receivable Aging Report
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aging schedule categorized into standard 30-day buckets for collection prioritisation and bad debt monitoring.
              </p>
            </div>
            <a
              href="/api/reports/aging/export"
              download="aging_receivables_report.csv"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 self-start sm:self-auto")}
            >
              <Download className="h-4 w-4" />
              Export Aging CSV
            </a>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-rule">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-rule bg-paper-2 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4">Aging Bracket</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule text-xs">
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-foreground">Current</td>
                  <td className="py-2.5 px-4 text-muted-foreground">Not yet past invoice due date</td>
                  <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">Standard terms</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-foreground">1 – 30 Days</td>
                  <td className="py-2.5 px-4 text-muted-foreground">Grace period &amp; gentle reminders</td>
                  <td className="py-2.5 px-4 text-right text-amber-600 font-medium">Follow-up</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-foreground">31 – 60 Days</td>
                  <td className="py-2.5 px-4 text-muted-foreground">Escalated reminder sequence</td>
                  <td className="py-2.5 px-4 text-right text-amber-600 font-medium">Actionable</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-foreground">61 – 90 Days</td>
                  <td className="py-2.5 px-4 text-muted-foreground">Urgent collection call / suspension notice</td>
                  <td className="py-2.5 px-4 text-right text-rose-500 font-medium">Critical</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-foreground">90+ Days</td>
                  <td className="py-2.5 px-4 text-muted-foreground">Severe delinquency / write-off assessment</td>
                  <td className="py-2.5 px-4 text-right text-rose-600 font-semibold">Severely Overdue</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Report 3: Subscriptions & MRR Breakdown */}
        <div className="rounded-lg border border-rule bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" />
                Subscription &amp; MRR Performance Report
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active customer contracts, plan breakdowns, and normalized monthly run-rate metrics.
              </p>
            </div>
            <a
              href="/api/reports/subscriptions/export"
              download="subscriptions_report.csv"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 self-start sm:self-auto")}
            >
              <Download className="h-4 w-4" />
              Export Subscriptions CSV
            </a>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-rule">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-rule bg-paper-2 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4">Plan Name</th>
                  <th className="py-2.5 px-4 text-right">Subscribers</th>
                  <th className="py-2.5 px-4 text-right">Monthly Run-Rate (MRR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule text-xs">
                {metrics.planDistribution.map((plan) => (
                  <tr key={plan.planName} className="hover:bg-paper-3/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-foreground">{plan.planName}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{plan.count}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-foreground">
                      {formatMoney(plan.mrr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

