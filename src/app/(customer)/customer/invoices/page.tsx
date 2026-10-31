"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getCustomerInvoicesAction } from "@/server/actions/customer-portal";
import { Receipt, DollarSign, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";

interface CustomerInvoiceListItem {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  subscription: {
    id: string;
    subscriptionNumber: string;
    plan?: { name: string } | null;
  } | null;
}

export default function CustomerInvoicesPage() {
  const [invoices, setInvoices] = React.useState<CustomerInvoiceListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  const fetchInvoices = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomerInvoicesAction({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      if (!res.success) throw new Error(res.error || "Failed to load invoices");
      const d = res.data as { invoices: CustomerInvoiceListItem[] };
      setInvoices(d?.invoices || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error fetching invoices");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
  const totalBalanceDue = invoices.reduce((sum, inv) => sum + Number(inv.amountDue), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Invoices"
        breadcrumbs={[
          { label: "Portal", href: "/customer" },
          { label: "Invoices" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInvoices}
            disabled={loading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Billed"
          value={`$${totalInvoiced.toFixed(2)}`}
          icon={Receipt}
          subtitle="Cumulative billing charges"
        />
        <KpiCard
          title="Total Paid"
          value={`$${totalPaid.toFixed(2)}`}
          icon={CheckCircle2}
          subtitle="Settled payments"
        />
        <KpiCard
          title="Remaining Balance Due"
          value={`$${totalBalanceDue.toFixed(2)}`}
          icon={AlertCircle}
          subtitle={totalBalanceDue > 0 ? "Awaiting payment" : "All accounts clear"}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-md bg-paper border border-border text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="ALL">All Invoices</option>
            <option value="CONFIRMED">Pending / Unpaid</option>
            <option value="PAID">Fully Paid</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-lg border border-border bg-paper overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading your invoices...</div>
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No invoices found"
            description="You do not have any invoices matching your selected filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Subscription</th>
                  <th className="py-3 px-4">Issued On</th>
                  <th className="py-3 px-4">Payment Due</th>
                  <th className="py-3 px-4">Total Value</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-paper-2/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-accent">
                      <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                        #{inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">
                      {inv.subscription ? (
                        <div>
                          <span className="font-semibold text-ink">
                            {inv.subscription.plan?.name || "Subscription"}
                          </span>
                          <div className="font-mono text-[11px]">
                            {inv.subscription.subscriptionNumber}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-ink-muted">
                      {new Date(inv.issueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-ink-muted">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-ink">
                      ${Number(inv.totalAmount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      ${Number(inv.amountPaid).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-sm text-ink">
                      ${Number(inv.amountDue).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/customer/invoices/${inv.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-accent hover:text-accent/80 gap-1"
                        >
                          Invoice <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

