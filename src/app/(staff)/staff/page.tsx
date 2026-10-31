import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { reportingService } from "@/server/services/reporting";
import { requireRole } from "@/server/auth/guards";
import {
  CreditCard,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  ArrowRight,
  DollarSign,
} from "lucide-react";

export default async function StaffDashboardPage() {
  try {
    await requireRole(["STAFF", "ADMIN"]);
  } catch {
    redirect("/login?callbackUrl=/staff");
  }

  const ops = await reportingService.getStaffOperationsMetrics();

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Operations Dashboard"
        description="Daily billing queue, collection actions, and active quotation workflows"
      />

      <div className="px-6 space-y-6">
        {/* KPI Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Outstanding"
            value={formatMoney(ops.totalOutstandingAmount)}
            subtitle={`${ops.outstandingCount} open confirmed invoices`}
            icon={CreditCard}
          />
          <KpiCard
            title="Overdue Invoices"
            value={formatMoney(ops.totalOverdueAmount)}
            subtitle={`${ops.overdueCount} require collection follow-up`}
            icon={AlertTriangle}
          />
          <KpiCard
            title="Due Today"
            value={ops.dueTodayCount}
            subtitle="Scheduled for payment settlement today"
            icon={Clock}
          />
          <KpiCard
            title="Active Quotations"
            value={ops.recentQuotations.length}
            subtitle="Pipeline awaiting confirmation"
            icon={FileSpreadsheet}
          />
        </div>

        {/* Due Today Queue */}
        <div className="rounded-lg border border-rule bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Invoices Due Today
              </h3>
              <p className="text-xs text-muted-foreground">
                Invoices maturing today that need immediate collection checks
              </p>
            </div>
            <Link
              href="/staff/outstanding"
              className="text-xs text-primary hover:underline font-medium"
            >
              View all outstanding
            </Link>
          </div>

          {ops.dueTodayInvoices.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-rule p-4 text-center text-xs text-muted-foreground">
              No invoices due for payment today.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-rule">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-rule bg-paper-2 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4 text-right">Balance Due</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {ops.dueTodayInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-paper-3/40 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs font-medium text-foreground">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-4 text-foreground font-medium text-xs">
                        {inv.customer.name}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-foreground">
                        {formatMoney(inv.amountDue)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Link
                          href={`/staff/invoices/${inv.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          <DollarSign className="h-3 w-3" />
                          Record Payment
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Overdue Collection Queue & Recent Quotations */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Overdue Queue */}
          <div className="rounded-lg border border-rule bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  Overdue Invoices
                </h3>
                <p className="text-xs text-muted-foreground">
                  High-priority collections past their scheduled due dates
                </p>
              </div>
              <Link
                href="/staff/outstanding"
                className="text-xs text-primary hover:underline font-medium"
              >
                Full list
              </Link>
            </div>

            {ops.overdueInvoices.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-rule p-4 text-center text-xs text-muted-foreground">
                All confirmed invoices are current. Zero overdue balances!
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-rule">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-rule bg-paper-2 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4">Invoice</th>
                      <th className="py-2.5 px-4">Customer</th>
                      <th className="py-2.5 px-4">Due Date</th>
                      <th className="py-2.5 px-4 text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {ops.overdueInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-paper-3/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-xs font-medium text-foreground">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-foreground">
                          {inv.customer.name}
                        </td>
                        <td className="py-2.5 px-4 tabular-nums text-xs text-rose-500 font-medium">
                          {formatDate(new Date(inv.dueDate))}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                          {formatMoney(inv.amountDue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Quotations */}
          <div className="rounded-lg border border-rule bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Recent Quotations
                </h3>
                <p className="text-xs text-muted-foreground">
                  Latest customer quotes prepared for subscription onboarding
                </p>
              </div>
              <Link
                href="/staff/quotations"
                className="text-xs text-primary hover:underline font-medium"
              >
                View quotes
              </Link>
            </div>

            {ops.recentQuotations.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-rule p-4 text-center text-xs text-muted-foreground">
                No active quotations found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-rule">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-rule bg-paper-2 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4">Quote #</th>
                      <th className="py-2.5 px-4">Customer</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {ops.recentQuotations.map((q) => (
                      <tr key={q.id} className="hover:bg-paper-3/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-xs font-medium text-foreground">
                          {q.quotationNumber}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-foreground">
                          {q.customer.name}
                        </td>
                        <td className="py-2.5 px-4 text-xs">
                          <StatusBadge status={q.status} />
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-foreground">
                          {formatMoney(Number(q.totalAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
