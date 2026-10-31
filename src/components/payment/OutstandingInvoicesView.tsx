"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RecordPaymentDialog,
  type RecordPaymentInvoice,
} from "@/components/payment/RecordPaymentDialog";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Search,
  RefreshCw,
  CreditCard,
  Receipt,
  ArrowUpRight,
} from "lucide-react";

interface OutstandingInvoiceItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  isOverdue: boolean;
  agingBracket: "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";
  customer: { id: string; name: string; email: string };
}

interface AgingMetrics {
  current: { count: number; totalAmount: number };
  days1To30: { count: number; totalAmount: number };
  days31To60: { count: number; totalAmount: number };
  days61To90: { count: number; totalAmount: number };
  days90Plus: { count: number; totalAmount: number };
  totalOutstanding: number;
  totalOverdue: number;
  totalInvoicesCount: number;
  overdueInvoicesCount: number;
}

interface OutstandingInvoicesViewProps {
  basePath: "/admin" | "/staff";
}

export function OutstandingInvoicesView({ basePath }: OutstandingInvoicesViewProps) {
  const [invoices, setInvoices] = React.useState<OutstandingInvoiceItem[]>([]);
  const [metrics, setMetrics] = React.useState<AgingMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [bracketFilter, setBracketFilter] = React.useState("ALL");

  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<RecordPaymentInvoice | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/outstanding?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load outstanding invoices");
      const data = await res.json();
      setInvoices(data.invoices || []);
      setMetrics(data.metrics || null);
    } catch {
      toast.error("Could not fetch outstanding invoices");
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const filteredInvoices = React.useMemo(() => {
    if (bracketFilter === "ALL") return invoices;
    return invoices.filter((i) => i.agingBracket === bracketFilter);
  }, [invoices, bracketFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outstanding & Overdue Invoices"
        breadcrumbs={[
          { label: basePath === "/admin" ? "Admin" : "Staff", href: basePath },
          { label: "Outstanding Receivables" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Outstanding"
          value={`$${(metrics?.totalOutstanding || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          subtitle={`${metrics?.totalInvoicesCount || 0} unpaid or partial invoices`}
        />
        <KpiCard
          title="Total Past Due"
          value={`$${(metrics?.totalOverdue || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={AlertTriangle}
          subtitle={`${metrics?.overdueInvoicesCount || 0} overdue invoices`}
        />
        <KpiCard
          title="Critical Overdue (60+ Days)"
          value={`$${((metrics?.days61To90.totalAmount || 0) + (metrics?.days90Plus.totalAmount || 0)).toFixed(2)}`}
          icon={Clock}
          subtitle="Aged past 60 days"
        />
        <KpiCard
          title="Current / Not Yet Due"
          value={`$${(metrics?.current.totalAmount || 0).toFixed(2)}`}
          icon={Receipt}
          subtitle={`${metrics?.current.count || 0} invoices within terms`}
        />
      </div>

      {/* Aging Analysis Cards */}
      <div className="p-4 rounded-lg border border-border bg-paper space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-ink-muted uppercase tracking-wider">
          <span>Receivables Aging Buckets</span>
          <span className="text-[11px] font-normal normal-case">Filter table by selecting a bucket</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <button
            onClick={() => setBracketFilter(bracketFilter === "CURRENT" ? "ALL" : "CURRENT")}
            className={`p-3 rounded-lg border text-left transition-all ${
              bracketFilter === "CURRENT"
                ? "border-accent bg-accent/10"
                : "border-border bg-paper-2 hover:border-accent/40"
            }`}
          >
            <span className="text-ink-muted block text-[11px]">Current (Not Due)</span>
            <span className="font-bold text-ink font-mono text-sm">
              ${(metrics?.current.totalAmount || 0).toFixed(2)}
            </span>
            <span className="text-ink-muted block text-[10px]">
              {metrics?.current.count || 0} invoices
            </span>
          </button>

          <button
            onClick={() => setBracketFilter(bracketFilter === "1_30" ? "ALL" : "1_30")}
            className={`p-3 rounded-lg border text-left transition-all ${
              bracketFilter === "1_30"
                ? "border-amber-500 bg-amber-500/10"
                : "border-border bg-paper-2 hover:border-amber-500/40"
            }`}
          >
            <span className="text-amber-600 dark:text-amber-400 block text-[11px]">1–30 Days Overdue</span>
            <span className="font-bold text-ink font-mono text-sm">
              ${(metrics?.days1To30.totalAmount || 0).toFixed(2)}
            </span>
            <span className="text-ink-muted block text-[10px]">
              {metrics?.days1To30.count || 0} invoices
            </span>
          </button>

          <button
            onClick={() => setBracketFilter(bracketFilter === "31_60" ? "ALL" : "31_60")}
            className={`p-3 rounded-lg border text-left transition-all ${
              bracketFilter === "31_60"
                ? "border-orange-500 bg-orange-500/10"
                : "border-border bg-paper-2 hover:border-orange-500/40"
            }`}
          >
            <span className="text-orange-600 dark:text-orange-400 block text-[11px]">31–60 Days Overdue</span>
            <span className="font-bold text-ink font-mono text-sm">
              ${(metrics?.days31To60.totalAmount || 0).toFixed(2)}
            </span>
            <span className="text-ink-muted block text-[10px]">
              {metrics?.days31To60.count || 0} invoices
            </span>
          </button>

          <button
            onClick={() => setBracketFilter(bracketFilter === "61_90" ? "ALL" : "61_90")}
            className={`p-3 rounded-lg border text-left transition-all ${
              bracketFilter === "61_90"
                ? "border-rose-500 bg-rose-500/10"
                : "border-border bg-paper-2 hover:border-rose-500/40"
            }`}
          >
            <span className="text-rose-600 dark:text-rose-400 block text-[11px]">61–90 Days Overdue</span>
            <span className="font-bold text-ink font-mono text-sm">
              ${(metrics?.days61To90.totalAmount || 0).toFixed(2)}
            </span>
            <span className="text-ink-muted block text-[10px]">
              {metrics?.days61To90.count || 0} invoices
            </span>
          </button>

          <button
            onClick={() => setBracketFilter(bracketFilter === "90_PLUS" ? "ALL" : "90_PLUS")}
            className={`p-3 rounded-lg border text-left transition-all ${
              bracketFilter === "90_PLUS"
                ? "border-purple-500 bg-purple-500/10"
                : "border-border bg-paper-2 hover:border-purple-500/40"
            }`}
          >
            <span className="text-purple-600 dark:text-purple-400 block text-[11px]">90+ Days (Critical)</span>
            <span className="font-bold text-ink font-mono text-sm">
              ${(metrics?.days90Plus.totalAmount || 0).toFixed(2)}
            </span>
            <span className="text-ink-muted block text-[10px]">
              {metrics?.days90Plus.count || 0} invoices
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <Input
            placeholder="Search invoice # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-paper text-sm"
          />
        </div>

        {bracketFilter !== "ALL" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">Filtered by bucket: {bracketFilter}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBracketFilter("ALL")}
              className="text-xs h-8"
            >
              Clear Filter
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-paper overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading outstanding receivables...</div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            title="No outstanding invoices found"
            description="All confirmed invoices in this filter are fully paid. Excellent cash flow!"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Total Value</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-paper-2/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-accent">
                      <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                        #{inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-ink">
                      <div>{inv.customer.name}</div>
                      <div className="text-xs text-ink-muted">{inv.customer.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono">
                      <div>{new Date(inv.dueDate).toLocaleDateString()}</div>
                      {inv.isOverdue ? (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          OVERDUE
                        </span>
                      ) : (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] text-ink-muted">
                          Within terms
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-ink-muted">
                      ${inv.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      ${inv.amountPaid.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-sm text-ink">
                      ${inv.amountDue.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs bg-accent text-white hover:bg-accent/90"
                        onClick={() => {
                          setSelectedInvoice({
                            id: inv.id,
                            invoiceNumber: inv.invoiceNumber,
                            amountDue: inv.amountDue,
                            totalAmount: inv.totalAmount,
                            customerName: inv.customer.name,
                          });
                          setPaymentDialogOpen(true);
                        }}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Record Payment
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
        onSuccess={fetchData}
      />
    </div>
  );
}

