"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getCustomerPaymentsAction } from "@/server/actions/customer-portal";
import { CreditCard, DollarSign, Receipt, ArrowDownRight, RefreshCw } from "lucide-react";

interface CustomerPaymentItem {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  referenceNote?: string | null;
  invoice: { id: string; invoiceNumber: string; totalAmount: number; status: string } | null;
}

export default function CustomerPaymentsPage() {
  const [payments, setPayments] = React.useState<CustomerPaymentItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchPayments = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomerPaymentsAction();
      if (!res.success) throw new Error(res.error || "Failed to load payment history");
      const d = res.data as { payments: CustomerPaymentItem[] };
      setPayments(d?.payments || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error fetching payments");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalCount = payments.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Receipts"
        breadcrumbs={[
          { label: "Portal", href: "/customer" },
          { label: "Payments" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPayments}
            disabled={loading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="Total Payments Completed"
          value={`$${totalPaid.toFixed(2)}`}
          icon={DollarSign}
          subtitle="Lifetime settled payments"
        />
        <KpiCard
          title="Payment Receipts"
          value={totalCount}
          icon={Receipt}
          subtitle="Recorded transactions"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-paper overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading your payment records...</div>
        ) : payments.length === 0 ? (
          <EmptyState
            title="No payments on record"
            description="You do not have any recorded payment receipts yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Invoice Applied</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Reference Note</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-paper-2/50 transition-colors">
                    <td className="py-3.5 px-4 text-xs font-mono text-ink-muted whitespace-nowrap">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-accent">
                      <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                        {p.paymentNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {p.invoice ? (
                        <Link
                          href={`/customer/invoices/${p.invoice.id}`}
                          className="hover:underline text-accent font-semibold"
                        >
                          #{p.invoice.invoiceNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded bg-paper-3 font-medium text-ink">
                        {p.paymentMethod.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">
                      {p.referenceNote || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      <div className="flex items-center justify-end gap-1">
                        <ArrowDownRight className="h-4 w-4" />
                        <span>+${Number(p.amount).toFixed(2)}</span>
                      </div>
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

