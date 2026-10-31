"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { transitionSubscriptionAction } from "@/server/actions/subscription";
import { formatDate } from "@/lib/dates";
import {
  Play,
  Pause,
  RotateCcw,
  XCircle,
  CheckCircle2,
  ArrowLeft,
  Building,
  Calendar,
  CreditCard,
  Layers,
  FileText,
} from "lucide-react";

interface SubscriptionDetailProps {
  subscription: any;
  basePath?: string; // "/admin" or "/staff"
}

export function SubscriptionDetailView({
  subscription,
  basePath = "/admin",
}: SubscriptionDetailProps) {
  const router = useRouter();
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const status = subscription.status;

  const handleAction = async (action: "CONFIRM" | "ACTIVATE" | "PAUSE" | "RESUME" | "RENEW" | "CLOSE", reason?: string) => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await transitionSubscriptionAction({
        subscriptionId: subscription.id,
        action,
        reason,
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.error || `Failed to ${action.toLowerCase()} subscription` });
      } else {
        setFeedback({ type: "success", message: res.message || `Subscription updated to ${action}!` });
        router.refresh();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Action failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"];
  const currentStepIndex = steps.indexOf(status === "PAUSED" ? "ACTIVE" : status);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href={`${basePath}/subscriptions`} className="hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to Subscriptions
        </Link>
      </div>

      <PageHeader
        title={`Subscription ${subscription.subscriptionNumber}`}
        description={`Recurring contract for ${subscription.customer?.name || "Customer"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={subscription.status} />

            {/* ACTION CONTROLS */}
            {(status === "DRAFT" || status === "QUOTATION") && (
              <ConfirmDialog
                title="Confirm Subscription"
                description="Move this subscription to Confirmed status?"
                confirmLabel="Confirm"
                onConfirm={() => handleAction("CONFIRM")}
                trigger={
                  <Button size="sm" disabled={isSubmitting} className="gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                  </Button>
                }
              />
            )}

            {status === "CONFIRMED" && (
              <ConfirmDialog
                title="Activate Subscription"
                description="Activate this subscription and start recurring billing?"
                confirmLabel="Activate"
                onConfirm={() => handleAction("ACTIVATE")}
                trigger={
                  <Button size="sm" disabled={isSubmitting} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Play className="h-3.5 w-3.5" /> Activate
                  </Button>
                }
              />
            )}

            {status === "ACTIVE" && (
              <>
                {subscription.allowPause && (
                  <ConfirmDialog
                    title="Pause Subscription"
                    description="Temporarily pause recurring billing for this customer?"
                    confirmLabel="Pause Subscription"
                    onConfirm={() => handleAction("PAUSE", "Paused by user")}
                    trigger={
                      <Button variant="outline" size="sm" disabled={isSubmitting} className="gap-1.5 text-xs text-amber-600 border-amber-600/30 hover:bg-amber-50">
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </Button>
                    }
                  />
                )}

                {subscription.allowRenewal && (
                  <ConfirmDialog
                    title="Renew Subscription"
                    description={`Extend subscription by another ${(subscription.billingInterval || "monthly").toLowerCase()} cycle?`}
                    confirmLabel="Renew Now"
                    onConfirm={() => handleAction("RENEW", "Manual renewal triggered")}
                    trigger={
                      <Button variant="outline" size="sm" disabled={isSubmitting} className="gap-1.5 text-xs text-primary">
                        <RotateCcw className="h-3.5 w-3.5" /> Renew
                      </Button>
                    }
                  />
                )}

                {subscription.allowEarlyClose && (
                  <ConfirmDialog
                    title="Close Subscription"
                    description="Early closure: terminate subscription immediately and cease future billing cycles?"
                    confirmLabel="Close Subscription"
                    variant="destructive"
                    onConfirm={() => handleAction("CLOSE", "Early cancellation requested")}
                    trigger={
                      <Button variant="outline" size="sm" disabled={isSubmitting} className="gap-1.5 text-xs text-destructive border-destructive/20 hover:bg-destructive/10">
                        <XCircle className="h-3.5 w-3.5" /> Close Early
                      </Button>
                    }
                  />
                )}
              </>
            )}

            {status === "PAUSED" && (
              <>
                <ConfirmDialog
                  title="Resume Subscription"
                  description="Resume recurring service and reactivate billing cycles?"
                  confirmLabel="Resume Subscription"
                  onConfirm={() => handleAction("RESUME", "Resumed service")}
                  trigger={
                    <Button size="sm" disabled={isSubmitting} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Play className="h-3.5 w-3.5" /> Resume
                    </Button>
                  }
                />

                <ConfirmDialog
                  title="Close Subscription"
                  description="Permanently close this paused subscription?"
                  confirmLabel="Close"
                  variant="destructive"
                  onConfirm={() => handleAction("CLOSE", "Closed while paused")}
                  trigger={
                    <Button variant="outline" size="sm" disabled={isSubmitting} className="gap-1.5 text-xs text-destructive border-destructive/20 hover:bg-destructive/10">
                      <XCircle className="h-3.5 w-3.5" /> Close
                    </Button>
                  }
                />
              </>
            )}
          </div>
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded text-xs border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {status === "CLOSED" && (
        <div className="p-4 rounded-lg bg-muted border text-xs text-muted-foreground">
          <strong>Closed Subscription:</strong> This subscription has terminated. In accordance with system policy, closed subscriptions cannot be reactivated. To resume service, please issue a new quote.
        </div>
      )}

      {/* LIFECYCLE TIMELINE VISUALIZATION */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-border -z-0" />
            {steps.map((step, idx) => {
              const isPastOrCurrent = currentStepIndex >= idx;
              const isCurrent = (status === "PAUSED" && step === "ACTIVE") || status === step;

              return (
                <div key={step} className="flex flex-col items-center gap-2 bg-card px-2 z-10">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isCurrent
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : isPastOrCurrent
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground border"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span
                    className={`text-[11px] font-medium uppercase tracking-wider ${
                      isCurrent ? "text-primary font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {step}
                    {status === "PAUSED" && step === "ACTIVE" && " (Paused)"}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* METADATA CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" /> Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium text-foreground">{subscription.customer?.name || "Customer"}</div>
            <div className="text-xs text-muted-foreground">{subscription.customer?.email || ""}</div>
            {subscription.customer?.phone && (
              <div className="text-xs text-muted-foreground">{subscription.customer.phone}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Plan Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1.5">
            <div className="font-medium text-sm text-foreground">{subscription.plan?.name || "Standard Plan"}</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Interval:</span>
              <span className="font-semibold uppercase">{subscription.billingInterval}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 pt-1 text-[11px]">
              <div>Pause: {subscription.allowPause ? "✓ Allowed" : "✗ Denied"}</div>
              <div>Renew: {subscription.allowRenewal ? "✓ Allowed" : "✗ Denied"}</div>
              <div>Early Close: {subscription.allowEarlyClose ? "✓ Allowed" : "✗ Denied"}</div>
              <div>Auto-Close: {subscription.autoCloseAtEnd ? "✓ Yes" : "— No"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Period & Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1.5">
            <div>
              <span className="text-muted-foreground">Started:</span>{" "}
              <span className="font-medium">{formatDate(subscription.startDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Period:</span>
              <div className="font-medium">
                {formatDate(subscription.currentPeriodStart)} &rarr; {formatDate(subscription.currentPeriodEnd)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Next Billing Date:</span>{" "}
              <span className="font-bold text-primary">
                {subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LINE ITEMS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Active Plan & Add-On Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Recurring Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscription.items.map((line: any) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div className="font-medium">{line.description || line.product?.name}</div>
                    {line.variant && (
                      <div className="text-xs text-muted-foreground">Variant: {line.variant.name}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{line.quantity}</TableCell>
                  <TableCell className="text-right font-mono">
                    <MoneyText amount={line.unitPrice} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    <MoneyText amount={line.taxAmount} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-600">
                    <MoneyText amount={line.discountAmount} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    <MoneyText amount={line.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* TOTAL */}
          <div className="p-4 bg-muted/20 border-t flex justify-end">
            <div className="flex items-center gap-4 text-sm font-bold">
              <span>Recurring Cycle Total:</span>
              <span className="font-mono text-primary text-base">
                <MoneyText amount={subscription.totalAmount} />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

