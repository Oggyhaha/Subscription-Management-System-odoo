"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { SubscriptionActionButtons } from "@/components/portal/SubscriptionActionButtons";
import { getCustomerSubscriptionDetailsAction } from "@/server/actions/customer-portal";
import {
  Repeat,
  Calendar,
  Clock,
  ArrowLeft,
  Receipt,
  Package,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function CustomerSubscriptionDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [subscription, setSubscription] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchDetails = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getCustomerSubscriptionDetailsAction(id);
      if (!res.success) {
        throw new Error(res.error || "Subscription not found");
      }
      setSubscription(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading subscription details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Subscription Details" />
        <div className="p-12 text-center text-ink-muted">Loading subscription...</div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <PageHeader title="Subscription Details" />
        <div className="p-12 text-center text-ink-muted">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2 opacity-80" />
          <h2 className="text-base font-semibold text-ink">Subscription Not Found</h2>
          <p className="text-xs text-ink-muted mt-1">
            This subscription record does not exist or is not associated with your customer account.
          </p>
          <div className="pt-4">
            <Link href="/customer/subscriptions">
              <Button variant="outline" size="sm">Back to Subscriptions</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <Link
          href="/customer/subscriptions"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Subscriptions
        </Link>

        {/* Action Buttons: Pause / Resume / Renew */}
        <SubscriptionActionButtons
          subscriptionId={subscription.id}
          status={subscription.status}
          allowPause={subscription.allowPause}
          allowRenewal={subscription.allowRenewal}
          onSuccess={fetchDetails}
        />
      </div>

      <PageHeader
        title={`Subscription #${subscription.subscriptionNumber}`}
        breadcrumbs={[
          { label: "Portal", href: "/customer" },
          { label: "Subscriptions", href: "/customer/subscriptions" },
          { label: `#${subscription.subscriptionNumber}` },
        ]}
        actions={<StatusBadge status={subscription.status} />}
      />

      {/* Plan & Period Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan Info */}
        <div className="p-6 rounded-lg border border-border bg-paper space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Package className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Plan Information</h2>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-muted">Plan Name:</span>
              <span className="font-semibold text-ink text-sm">{subscription.plan?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Plan Code:</span>
              <span className="font-mono text-ink">{subscription.plan?.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Billing Cadence:</span>
              <span className="px-2 py-0.5 rounded bg-paper-2 border border-border font-medium text-ink">
                {subscription.billingInterval}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Payment Terms:</span>
              <span className="font-medium text-ink">{subscription.paymentTerms}</span>
            </div>
          </div>
        </div>

        {/* Schedule & Dates */}
        <div className="p-6 rounded-lg border border-border bg-paper space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Calendar className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Subscription Schedule</h2>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-muted">Initial Start Date:</span>
              <span className="font-mono text-ink">
                {new Date(subscription.startDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Current Period Start:</span>
              <span className="font-mono text-ink">
                {new Date(subscription.currentPeriodStart).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Current Period End:</span>
              <span className="font-mono text-ink font-semibold">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Next Automated Billing:</span>
              <span className="font-mono text-accent font-semibold">
                {subscription.nextBillingDate
                  ? new Date(subscription.nextBillingDate).toLocaleDateString()
                  : "None scheduled"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Line Items */}
      <div className="p-6 rounded-lg border border-border bg-paper space-y-4">
        <h2 className="text-sm font-semibold text-ink">Covered Items & Services</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-2 border-b border-border font-semibold text-ink-muted">
              <tr>
                <th className="py-2.5 px-4">Item</th>
                <th className="py-2.5 px-4 text-center">Quantity</th>
                <th className="py-2.5 px-4 text-right">Unit Rate</th>
                <th className="py-2.5 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscription.items?.map((it: any) => (
                <tr key={it.id}>
                  <td className="py-3 px-4 font-medium text-ink">
                    <div>{it.description}</div>
                    {it.variant && (
                      <span className="text-[11px] text-ink-muted">
                        Variant: {it.variant.name}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-ink-muted">{it.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono text-ink-muted">
                    ₹${Number(it.unitPrice).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-ink">
                    ₹${Number(it.lineTotal).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2 text-xs">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-ink-muted">
              <span>Subtotal:</span>
              <span className="font-mono text-ink">₹${Number(subscription.subtotal).toFixed(2)}</span>
            </div>
            {subscription.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discounts:</span>
                <span className="font-mono">-₹${Number(subscription.discountTotal).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-ink-muted">
              <span>Tax Total:</span>
              <span className="font-mono text-ink">₹${Number(subscription.taxTotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border text-ink">
              <span>Total per Cycle:</span>
              <span className="font-mono">₹${Number(subscription.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Invoices Section */}
      <div className="p-6 rounded-lg border border-border bg-paper space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Generated Billing Invoices</h2>
          </div>
          <span className="text-xs text-ink-muted">
            {subscription.invoices?.length || 0} invoice(s)
          </span>
        </div>

        {!subscription.invoices || subscription.invoices.length === 0 ? (
          <p className="text-xs text-ink-muted py-2">
            No invoices have been billed for this subscription yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {subscription.invoices.map((inv: any) => (
              <div
                key={inv.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-ink text-sm">
                    #{inv.invoiceNumber}
                  </span>
                  <div className="text-ink-muted mt-0.5">
                    Issued: {new Date(inv.issueDate).toLocaleDateString()} • Due:{" "}
                    {new Date(inv.dueDate).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <StatusBadge status={inv.status} />
                  <span className="font-mono font-bold text-sm text-ink">
                    ₹${Number(inv.totalAmount).toFixed(2)}
                  </span>
                  <Link href={`/customer/invoices/${inv.id}`}>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      View
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

