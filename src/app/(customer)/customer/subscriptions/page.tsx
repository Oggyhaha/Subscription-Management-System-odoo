"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getCustomerSubscriptionsAction } from "@/server/actions/customer-portal";
import { Repeat, ArrowRight, Calendar, DollarSign, RefreshCw } from "lucide-react";

interface CustomerSubscriptionItem {
  id: string;
  subscriptionNumber: string;
  status: string;
  startDate: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string | null;
  billingInterval: string;
  totalAmount: number;
  plan: {
    id: string;
    name: string;
    code: string;
    billingInterval: string;
    allowPause: boolean;
    allowRenewal: boolean;
  };
  items: Array<{
    id: string;
    product: { name: string };
    quantity: number;
  }>;
}

export default function CustomerSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = React.useState<CustomerSubscriptionItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchSubscriptions = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomerSubscriptionsAction();
      if (!res.success) throw new Error(res.error || "Failed to load subscriptions");
      setSubscriptions((res.data as CustomerSubscriptionItem[]) || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error fetching subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Subscriptions"
        breadcrumbs={[
          { label: "Portal", href: "/customer" },
          { label: "Subscriptions" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSubscriptions}
            disabled={loading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-paper overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading your subscriptions...</div>
        ) : subscriptions.length === 0 ? (
          <EmptyState
            title="No subscriptions active"
            description="You do not have any active or past subscriptions registered to your account."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Subscription #</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Billing Cadence</th>
                  <th className="py-3 px-4">Current Period</th>
                  <th className="py-3 px-4">Next Renewal</th>
                  <th className="py-3 px-4">Recurring Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-paper-2/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-accent">
                      <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                        #{sub.subscriptionNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-ink">
                      <div>{sub.plan.name}</div>
                      <div className="text-xs text-ink-muted font-normal">
                        {sub.items.length} product item(s) included
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-ink">
                      <span className="px-2 py-0.5 rounded bg-paper-3 border border-border">
                        {sub.billingInterval}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-ink-muted">
                      {new Date(sub.currentPeriodStart).toLocaleDateString()} –{" "}
                      {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-ink-muted">
                      {sub.nextBillingDate
                        ? new Date(sub.nextBillingDate).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-ink">
                      ${Number(sub.totalAmount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/customer/subscriptions/${sub.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-accent hover:text-accent/80 gap-1"
                        >
                          Manage <ArrowRight className="h-3 w-3" />
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

