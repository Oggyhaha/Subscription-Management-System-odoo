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
import { executeInvoiceAction } from "@/server/actions/invoice";
import { formatDate } from "@/lib/dates";
import {
  Printer,
  CheckCircle2,
  XCircle,
  Mail,
  ArrowLeft,
  Calendar,
  Building,
  CreditCard,
  Layers,
  FileText,
  AlertCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { PaymentHistoryTable, RecordPaymentDialog } from "@/components/payment";

interface InvoiceDetailViewProps {
  invoice: any;
  basePath?: string; // "/admin" or "/staff"
}

export function InvoiceDetailView({ invoice, basePath = "/admin" }: InvoiceDetailViewProps) {
  const router = useRouter();
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);

  const status = invoice.status;
  const isPaid = status === "PAID";
  const isCancelled = status === "CANCELLED";
  const isDraft = status === "DRAFT";
  const isConfirmed = status === "CONFIRMED";

  const handleAction = async (action: "CONFIRM" | "CANCEL" | "MARK_PAID" | "SEND", reason?: string) => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await executeInvoiceAction({
        invoiceId: invoice.id,
        action,
        reason,
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.error || `Failed to ${action.toLowerCase()} invoice` });
      } else {
        setFeedback({ type: "success", message: res.message || `Invoice ${action.toLowerCase()}ed successfully.` });
        router.refresh();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Action failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const customer = invoice.customer;
  const user = customer?.user;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb back link */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href={`${basePath}/invoices`} className="hover:underline flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to Invoices
        </Link>
      </div>

      {/* Header with Title and Actions */}
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`Billing for ${customer?.name || user?.name || "Customer"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${basePath}/invoices/${invoice.id}/print`} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Printer className="h-4 w-4" /> Print / PDF
              </Button>
            </Link>

            {/* Confirm action for DRAFT */}
            {isDraft && (
              <ConfirmDialog
                title="Confirm Invoice"
                description={`Confirming invoice ${invoice.invoiceNumber} will finalize its billing amounts and enable sending it to the customer.`}
                confirmLabel="Confirm Invoice"
                onConfirm={() => handleAction("CONFIRM")}
                isLoading={isSubmitting}
                trigger={
                  <Button size="sm" className="gap-1.5" disabled={isSubmitting}>
                    <CheckCircle2 className="h-4 w-4" /> Confirm
                  </Button>
                }
              />
            )}

            {/* Send email action */}
            {!isCancelled && (
              <ConfirmDialog
                title="Send Invoice Email"
                description={`Deliver invoice ${invoice.invoiceNumber} to ${user?.email || customer?.email || "customer"} via email?`}
                confirmLabel="Send Email"
                onConfirm={() => handleAction("SEND")}
                isLoading={isSubmitting}
                trigger={
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={isSubmitting}>
                    <Mail className="h-4 w-4" /> {invoice.sentAt ? "Resend Email" : "Send Email"}
                  </Button>
                }
              />
            )}

            {/* Record Payment action */}
            {!isPaid && !isCancelled && (
              <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <CreditCard className="h-4 w-4" /> Record Payment
              </Button>
            )}

            {/* Cancel action (only when not PAID and not CANCELLED) */}
            {!isPaid && !isCancelled && (
              <ConfirmDialog
                title="Cancel Invoice"
                description={`Are you sure you want to cancel invoice ${invoice.invoiceNumber}? This action records an audit trail and cannot be undone.`}
                confirmLabel="Cancel Invoice"
                variant="destructive"
                onConfirm={() => handleAction("CANCEL", cancelReason || "Cancelled by staff")}
                isLoading={isSubmitting}
                trigger={
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10" disabled={isSubmitting}>
                    <XCircle className="h-4 w-4" /> Cancel
                  </Button>
                }
              />
            )}
          </div>
        }
      />

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-md text-xs border ${
            feedback.type === "success"
              ? "bg-status-active text-status-activeFg border-status-activeFg/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Paid Invoice Notice */}
      {isPaid && (
        <div className="flex items-center gap-2 p-3 bg-paper-2 border border-rule rounded-md text-xs text-ink">
          <ShieldCheck className="h-4 w-4 text-status-activeFg shrink-0" />
          <span>
            This invoice is <strong>Fully Paid</strong>. Paid invoices cannot be cancelled under financial compliance rules.
          </span>
        </div>
      )}

      {/* Quick Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-rule">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Due Date
            </div>
            <div className="text-sm font-semibold text-ink">{formatDate(invoice.dueDate)}</div>
            <div className="text-[11px] text-muted-foreground">Issued: {formatDate(invoice.issueDate)}</div>
          </CardContent>
        </Card>

        <Card className="border-rule">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Status
            </div>
            <div>
              <StatusBadge status={status} />
            </div>
            {invoice.sentAt && (
              <div className="text-[11px] text-muted-foreground">Sent: {formatDate(invoice.sentAt)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-rule">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Total Amount
            </div>
            <div className="text-lg font-bold font-mono text-ink">
              <MoneyText amount={invoice.totalAmount} />
            </div>
            <div className="text-[11px] text-muted-foreground">Paid: <MoneyText amount={invoice.amountPaid} /></div>
          </CardContent>
        </Card>

        <Card className="border-rule">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Balance Due
            </div>
            <div className="text-lg font-bold font-mono text-ink">
              <MoneyText amount={invoice.amountDue} />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {Number(invoice.amountDue) === 0 ? "Zero balance" : "Outstanding balance"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer & Contract Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-rule">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" /> Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>
              <span className="text-muted-foreground">Company:</span>{" "}
              <span className="font-medium text-ink">{customer?.name || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="font-mono text-ink">{user?.email || customer?.email || "N/A"}</span>
            </div>
            {(customer?.addressLine1 || customer?.city) && (
              <div>
                <span className="text-muted-foreground">Address:</span>{" "}
                <span className="text-ink">
                  {[customer.addressLine1, customer.city, customer.state, customer.postalCode, customer.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-rule">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" /> Contract & Cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {invoice.subscription ? (
              <div>
                <span className="text-muted-foreground">Subscription:</span>{" "}
                <Link
                  href={`${basePath}/subscriptions/${invoice.subscription.id}`}
                  className="font-mono text-ink hover:underline font-medium"
                >
                  {invoice.subscription.subscriptionNumber}
                </Link>
                <span className="ml-2 text-muted-foreground">({invoice.subscription.plan?.name || "Plan"})</span>
              </div>
            ) : (
              <div>
                <span className="text-muted-foreground">Type:</span> Direct Invoice
              </div>
            )}
            {invoice.cycleKey && (
              <div>
                <span className="text-muted-foreground">Cycle Key:</span>{" "}
                <span className="font-mono text-[11px] text-ink">{invoice.cycleKey}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Created At:</span>{" "}
              <span className="text-ink">{formatDate(invoice.createdAt)}</span>
            </div>
            {invoice.notes && (
              <div>
                <span className="text-muted-foreground">Notes:</span>{" "}
                <span className="text-ink italic">{invoice.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Line Items Table */}
      <Card className="border-rule">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Line Items Snapshot</CardTitle>
          <CardDescription className="text-xs">
            Immutable pricing snapshot recorded at invoice generation time.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-rule hover:bg-transparent">
                <TableHead className="text-xs">Item & Description</TableHead>
                <TableHead className="text-xs text-right">Quantity</TableHead>
                <TableHead className="text-xs text-right">Unit Price</TableHead>
                <TableHead className="text-xs text-right">Discount</TableHead>
                <TableHead className="text-xs text-right">Tax</TableHead>
                <TableHead className="text-xs text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((line: any) => (
                <TableRow key={line.id} className="border-rule hover:bg-paper-2">
                  <TableCell className="text-xs">
                    <div className="font-medium text-ink">{line.description}</div>
                    {line.variant && (
                      <div className="text-[11px] text-muted-foreground">Variant: {line.variant.name}</div>
                    )}
                    {line.variant?.sku && (
                      <div className="text-[11px] font-mono text-muted-foreground">SKU: {line.variant.sku}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">{line.quantity}</TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    <MoneyText amount={line.unitPrice} />
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {Number(line.discountAmount) > 0 ? (
                      <span className="text-status-activeFg">-<MoneyText amount={line.discountAmount} /></span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {Number(line.taxAmount) > 0 ? (
                      <span>
                        <MoneyText amount={line.taxAmount} />
                        {line.taxRule && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({(Number(line.taxRule.rate) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono font-medium text-ink">
                    <MoneyText amount={line.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pricing Totals Card */}
          <div className="p-4 border-t border-rule flex flex-col md:flex-row justify-between items-start gap-4 bg-paper-1">
            <div className="text-xs text-muted-foreground max-w-sm">
              <span className="font-semibold text-ink">Audit Guarantee:</span> Line items, applied tax rates, and discount
              snapshots are durably preserved and will not shift if catalog prices or tax rules change later.
            </div>

            <div className="w-full md:w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono text-ink">
                  <MoneyText amount={invoice.subtotal} />
                </span>
              </div>
              {Number(invoice.discountTotal) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discounts:</span>
                  <span className="font-mono text-status-activeFg">
                    -<MoneyText amount={invoice.discountTotal} />
                  </span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Taxes:</span>
                <span className="font-mono text-ink">
                  <MoneyText amount={invoice.taxTotal} />
                </span>
              </div>
              <div className="flex justify-between font-semibold text-sm text-ink border-t border-rule pt-1.5">
                <span>Total Amount:</span>
                <span className="font-mono">
                  <MoneyText amount={invoice.totalAmount} />
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Amount Paid:</span>
                <span className="font-mono text-ink">
                  <MoneyText amount={invoice.amountPaid} />
                </span>
              </div>
              <div className="flex justify-between font-bold text-sm text-ink border-t border-rule pt-1.5">
                <span>Balance Due:</span>
                <span className="font-mono">
                  <MoneyText amount={invoice.amountDue} />
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History Section */}
      <Card className="border-rule">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Payment History</CardTitle>
              <CardDescription className="text-xs">
                Payments recorded against this invoice. Multi-method and partial payments supported.
              </CardDescription>
            </div>
            {!isPaid && !isCancelled && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <CreditCard className="h-3.5 w-3.5" /> Record Payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <PaymentHistoryTable
            payments={(invoice.payments || []).map((p: any) => ({
              id: p.id,
              paymentNumber: p.paymentNumber,
              paymentDate: p.paymentDate,
              paymentMethod: p.paymentMethod,
              amount: Number(p.amount),
              referenceNote: p.referenceNote,
            }))}
          />
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={{
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountDue: Number(invoice.amountDue),
          totalAmount: Number(invoice.totalAmount),
          customerName: customer?.name || user?.name || "Customer",
        }}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
