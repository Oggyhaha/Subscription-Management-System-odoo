"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { acceptQuotationAction, sendQuotationAction, cancelQuotationAction } from "@/server/actions/quotation";
import { formatDate } from "@/lib/dates";
import { CheckCircle2, Send, XCircle, ArrowLeft, ArrowRight, Building, Calendar, FileText } from "lucide-react";

interface QuotationDetailProps {
  quotation: any;
  basePath?: string; // "/admin" or "/staff"
}

export function QuotationDetailView({ quotation, basePath = "/admin" }: QuotationDetailProps) {
  const router = useRouter();
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isActionable = quotation.status === "DRAFT" || quotation.status === "SENT";

  const handleAccept = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await acceptQuotationAction(quotation.id);
      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to accept quotation" });
      } else {
        setFeedback({ type: "success", message: res.message || "Quotation accepted into subscription!" });
        router.refresh();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to accept quotation" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await sendQuotationAction({ quotationId: quotation.id });
      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to send email" });
      } else {
        setFeedback({ type: "success", message: "Quotation email dispatched to customer." });
        router.refresh();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to send email" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await cancelQuotationAction(quotation.id, "Cancelled by user");
      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to cancel quotation" });
      } else {
        setFeedback({ type: "success", message: "Quotation has been cancelled." });
        router.refresh();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to cancel quotation" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href={`${basePath}/quotations`} className="hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to Quotations
        </Link>
      </div>

      <PageHeader
        title={`Quotation ${quotation.quotationNumber}`}
        description={`Offer prepared for ${quotation.customer.name}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={quotation.status} />

            {isActionable && (
              <>
                <Button variant="outline" size="sm" onClick={handleSend} disabled={isSubmitting} className="gap-1.5 text-xs">
                  <Send className="h-3.5 w-3.5" /> Send Email
                </Button>

                <ConfirmDialog
                  title="Cancel Quotation"
                  description="Are you sure you want to cancel this quotation? It will no longer be acceptable."
                  confirmLabel="Cancel Quotation"
                  variant="destructive"
                  onConfirm={handleCancel}
                  trigger={
                    <Button variant="outline" size="sm" disabled={isSubmitting} className="gap-1.5 text-xs text-destructive border-destructive/20 hover:bg-destructive/10">
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  }
                />

                <ConfirmDialog
                  title="Accept Quotation"
                  description={`Accept quotation #${quotation.quotationNumber} and create an active recurring Subscription?`}
                  confirmLabel="Confirm & Create Subscription"
                  onConfirm={handleAccept}
                  trigger={
                    <Button size="sm" disabled={isSubmitting} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Accept Quotation
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

      {quotation.subscription && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-sm font-semibold text-emerald-900">
                Converted to Subscription {quotation.subscription.subscriptionNumber}
              </div>
              <div className="text-xs text-emerald-700">
                This quotation was accepted and is running under active recurring billing.
              </div>
            </div>
          </div>
          <Button size="sm" asChild className="gap-1">
            <Link href={`${basePath}/subscriptions/${quotation.subscription.id}`}>
              View Subscription <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* METADATA CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" /> Customer Info
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium text-foreground">{quotation.customer.name}</div>
            <div className="text-xs text-muted-foreground">{quotation.customer.email}</div>
            {quotation.customer.phone && (
              <div className="text-xs text-muted-foreground">{quotation.customer.phone}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Plan & Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium text-foreground">{quotation.plan.name}</div>
            <div className="text-xs text-muted-foreground">
              Billing: {quotation.plan.billingInterval} &bull; Terms: {quotation.paymentTerms}
            </div>
            {quotation.template && (
              <div className="text-xs text-primary">From template: {quotation.template.name}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              <span className="text-muted-foreground text-xs">Issued Date:</span>{" "}
              <span className="font-medium">{formatDate(quotation.issuedDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Valid Until:</span>{" "}
              <span className="font-medium">{formatDate(quotation.validUntil)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LINE ITEMS TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Offer Product Lines</CardTitle>
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
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.map((line: any) => (
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

          {/* TOTALS BREAKDOWN */}
          <div className="p-6 bg-muted/30 border-t flex flex-col items-end gap-1.5">
            <div className="flex justify-between w-64 text-xs text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-mono"><MoneyText amount={quotation.subtotal} /></span>
            </div>
            <div className="flex justify-between w-64 text-xs text-emerald-600">
              <span>Discounts:</span>
              <span className="font-mono">-<MoneyText amount={quotation.discountTotal} /></span>
            </div>
            <div className="flex justify-between w-64 text-xs text-muted-foreground">
              <span>Taxes:</span>
              <span className="font-mono">+<MoneyText amount={quotation.taxTotal} /></span>
            </div>
            <div className="flex justify-between w-64 text-sm font-bold text-foreground border-t pt-2 mt-1">
              <span>Total Value:</span>
              <span className="font-mono text-primary"><MoneyText amount={quotation.totalAmount} /></span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

