"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  Search,
  RefreshCw,
  ArrowDownRight,
  Receipt,
  DollarSign,
  TrendingUp,
} from "lucide-react";

interface PaymentListItem {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  referenceNote?: string | null;
  customer: { id: string; name: string; email: string };
  invoice: { id: string; invoiceNumber: string; totalAmount: number; status: string } | null;
}

interface PaymentsListViewProps {
  basePath: "/admin" | "/staff";
}

export function PaymentsListView({ basePath }: PaymentsListViewProps) {
  const [payments, setPayments] = React.useState<PaymentListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [methodFilter, setMethodFilter] = React.useState("ALL");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const fetchPayments = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (methodFilter !== "ALL") params.set("method", methodFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load payments");
      const data = await res.json();
      setPayments(data.payments || []);
    } catch {
      toast.error("Could not fetch payments list");
    } finally {
      setLoading(false);
    }
  }, [search, methodFilter, startDate, endDate]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPayments();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPayments]);

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalCount = payments.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Transactions"
        breadcrumbs={[
          { label: basePath === "/admin" ? "Admin" : "Staff", href: basePath },
          { label: "Payments" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPayments}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Payments Received"
          value={`$${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          subtitle="Processed volume in view"
        />
        <KpiCard
          title="Total Transactions"
          value={totalCount}
          icon={Receipt}
          subtitle="Recorded receipts"
        />
        <KpiCard
          title="Avg. Transaction Size"
          value={totalCount > 0 ? `$${(totalCollected / totalCount).toFixed(2)}` : "$0.00"}
          icon={TrendingUp}
          subtitle="Mean payment amount"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <Input
            placeholder="Search payment #, invoice, customer, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-paper text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-10 px-3 rounded-md bg-paper border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="ALL">All Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer / UPI</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="ACH">ACH Direct Debit</option>
            <option value="CASH">Cash</option>
            <option value="CHECK">Cheque</option>
            <option value="OTHER">Other</option>
          </select>

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 bg-paper text-xs"
            title="Start date"
          />

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 bg-paper text-xs"
            title="End date"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-lg border border-border bg-paper overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading payment records...</div>
        ) : payments.length === 0 ? (
          <EmptyState
            title="No payments recorded"
            description="Recorded payments against confirmed customer invoices will appear in this ledger."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Method</th>
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
                    <td className="py-3.5 px-4 font-medium text-ink">
                      <div>{p.customer.name}</div>
                      <div className="text-xs text-ink-muted">{p.customer.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {p.invoice ? (
                        <span className="font-semibold text-ink">#{p.invoice.invoiceNumber}</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
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
                        <span>${Number(p.amount).toFixed(2)}</span>
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

