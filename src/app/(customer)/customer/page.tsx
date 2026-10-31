"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Repeat,
  Receipt,
  Calendar,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface DashboardData {
  activeSubscriptionsCount: number;
  activeSubscriptions: Array<{
    id: string;
    subscriptionNumber: string;
    status: string;
    billingInterval: string;
    totalAmount: number;
    nextBillingDate: string | null;
    currentPeriodEnd: string;
    plan: { id: string; name: string; code: string };
  }>;
  nextRenewal: {
    date: string | null;
    amount: number;
    planName: string;
  } | null;
  totalOutstanding: number;
  unpaidInvoicesCount: number;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    amountDue: number;
    totalAmount: number;
    dueDate: string;
  }>;
  recentPayments: Array<{
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    invoice: { id: string; invoiceNumber: string } | null;
  }>;
}

export default function CustomerDashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/customer/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load customer dashboard");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer Portal" />
        <div className="p-12 text-center text-ink-muted">Loading your subscription dashboard...</div>
      </div>
    );
  }

  const nextRenewalDateFormatted = data?.nextRenewal?.date
    ? new Date(data.nextRenewal.date).toLocaleDateString()
    : "No renewal scheduled";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Portal"
        breadcrumbs={[{ label: "Portal", href: "/customer" }, { label: "Dashboard" }]}
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Active Subscriptions"
          value={data?.activeSubscriptionsCount || 0}
          icon={Repeat}
          subtitle="Ongoing recurring services"
        />
        <KpiCard
          title="Next Renewal"
          value={
            data?.nextRenewal
              ? `₹${data.nextRenewal.amount.toFixed(2)}`
              : "None"
          }
          icon={Calendar}
          subtitle={
            data?.nextRenewal
              ? `${data.nextRenewal.planName} on ${nextRenewalDateFormatted}`
              : "No upcoming renewals"
          }
        />
        <KpiCard
          title="Outstanding Balance"
          value={`₹${(data?.totalOutstanding || 0).toFixed(2)}`}
          icon={Receipt}
          subtitle={
            (data?.unpaidInvoicesCount || 0) > 0
              ? `${data?.unpaidInvoicesCount} invoice(s) pending payment`
              : "All invoices settled"
          }
        />
      </div>

      {/* Active Subscriptions Section */}
      <div className="p-6 rounded-lg border border-border bg-paper space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">My Active Subscriptions</h2>
          </div>
          <Link
            href="/customer/subscriptions"
            className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-medium"
          >
            Manage Subscriptions <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {!data?.activeSubscriptions || data.activeSubscriptions.length === 0 ? (
          <EmptyState
            title="No active subscriptions"
            description="You currently have no active recurring subscriptions."
          />
        ) : (
          <div className="divide-y divide-border">
            {data.activeSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink text-sm">{sub.plan.name}</span>
                    <span className="font-mono text-xs text-accent">#{sub.subscriptionNumber}</span>
                  </div>
                  <div className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                    <span>Interval: {sub.billingInterval}</span>
                    <span>•</span>
                    <span>
                      Renews: {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-sm text-ink">
                    ₹${sub.totalAmount.toFixed(2)}
                  </span>
                  <Link href={`/customer/subscriptions/${sub.id}`}>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices & Receivables Section */}
      <div className="p-6 rounded-lg border border-border bg-paper space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Invoices Requiring Payment</h2>
          </div>
          <Link
            href="/customer/invoices"
            className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-medium"
          >
            All Invoices <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {!data?.recentInvoices || data.recentInvoices.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-muted flex flex-col items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-80" />
            <p className="font-medium text-ink">All caught up!</p>
            <p className="text-[11px] text-ink-muted mt-0.5">
              You have zero pending invoices or outstanding balances.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.recentInvoices.map((inv) => (
              <div
                key={inv.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="font-mono font-semibold text-ink text-sm">
                    #{inv.invoiceNumber}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    Due Date: {new Date(inv.dueDate).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[11px] text-ink-muted block">Balance Due:</span>
                    <span className="font-mono font-bold text-sm text-accent">
                      ₹${inv.amountDue.toFixed(2)}
                    </span>
                  </div>
                  <Link href={`/customer/invoices/${inv.id}`}>
                    <Button size="sm" className="text-xs h-8 bg-accent text-white hover:bg-accent/90">
                      View Invoice
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
