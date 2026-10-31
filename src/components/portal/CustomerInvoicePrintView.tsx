"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PaymentHistoryTable } from "@/components/payment/PaymentHistoryTable";
import { Printer, ArrowLeft, Building2, CheckCircle2 } from "lucide-react";

export interface InvoiceDetailsData {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string | Date;
  dueDate: string | Date;
  paidDate?: string | Date | null;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  notes?: string | null;
  customer: {
    name: string;
    email: string;
    phone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country: string;
    taxIdentifier?: string | null;
  };
  subscription?: {
    subscriptionNumber: string;
    plan?: { name: string; billingInterval: string } | null;
  } | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    discountAmount: number;
    lineTotal: number;
    product?: { name: string } | null;
    variant?: { name: string } | null;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentDate: string | Date;
    paymentMethod: string;
    amount: number;
    referenceNote?: string | null;
  }>;
}

interface CustomerInvoicePrintViewProps {
  invoice: InvoiceDetailsData;
}

export function CustomerInvoicePrintView({ invoice }: CustomerInvoicePrintViewProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top action bar (hidden during print) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/customer/invoices"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Invoices
        </Link>

        <Button
          onClick={handlePrint}
          variant="outline"
          size="sm"
          className="gap-2 text-xs bg-paper"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>

      {/* Printable Invoice Container */}
      <div className="p-8 sm:p-12 rounded-xl border border-border bg-paper shadow-xs space-y-8 print:p-0 print:border-none print:shadow-none">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-border">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white font-bold text-sm">
                B
              </div>
              <span className="text-xl font-bold tracking-tight text-ink">
                Brightloop Software
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              100 Innovation Way, Suite 400<br />
              San Francisco, CA 94105<br />
              billing@brightloop.com
            </p>
          </div>

          <div className="sm:text-right space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink font-mono">
              INVOICE #{invoice.invoiceNumber}
            </h1>
            <div className="pt-1">
              <StatusBadge status={invoice.status} />
            </div>
            {invoice.subscription && (
              <p className="text-xs text-ink-muted pt-1">
                Subscription: <span className="font-mono">{invoice.subscription.subscriptionNumber}</span>
              </p>
            )}
          </div>
        </div>

        {/* Invoice Meta & Billed To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
          <div>
            <h3 className="font-semibold text-ink uppercase tracking-wider mb-2">Billed To</h3>
            <div className="space-y-0.5 text-ink-muted">
              <p className="font-bold text-ink text-sm">{invoice.customer.name}</p>
              <p>{invoice.customer.email}</p>
              {invoice.customer.phone && <p>{invoice.customer.phone}</p>}
              {invoice.customer.addressLine1 && <p>{invoice.customer.addressLine1}</p>}
              {invoice.customer.city && (
                <p>
                  {invoice.customer.city}, {invoice.customer.state} {invoice.customer.postalCode}
                </p>
              )}
              {invoice.customer.taxIdentifier && (
                <p className="pt-1 font-mono">Tax ID: {invoice.customer.taxIdentifier}</p>
              )}
            </div>
          </div>

          <div className="sm:text-right space-y-1.5">
            <div>
              <span className="text-ink-muted">Invoice Date: </span>
              <span className="font-medium text-ink font-mono">
                {new Date(invoice.issueDate).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-ink-muted">Payment Due: </span>
              <span className="font-medium text-ink font-mono">
                {new Date(invoice.dueDate).toLocaleDateString()}
              </span>
            </div>
            {invoice.paidDate && (
              <div>
                <span className="text-ink-muted">Paid Date: </span>
                <span className="font-medium text-emerald-600 font-mono">
                  {new Date(invoice.paidDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border rounded-lg border-border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-2 border-b border-border text-ink-muted font-semibold">
              <tr>
                <th className="py-2.5 px-4">Item Description</th>
                <th className="py-2.5 px-4 text-center">Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Price</th>
                <th className="py-2.5 px-4 text-right">Tax</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-3 px-4 font-medium text-ink">
                    <div>{it.description}</div>
                    {it.variant && (
                      <span className="text-[11px] text-ink-muted">Variant: {it.variant.name}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-ink-muted">
                    {it.quantity}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-ink-muted">
                    ${it.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-ink-muted">
                    ${it.taxAmount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-ink">
                    ${it.lineTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-end text-xs">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-ink-muted">
              <span>Subtotal:</span>
              <span className="font-mono text-ink">${invoice.subtotal.toFixed(2)}</span>
            </div>

            {invoice.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discounts Applied:</span>
                <span className="font-mono">-${invoice.discountTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-ink-muted">
              <span>Tax:</span>
              <span className="font-mono text-ink">${invoice.taxTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border text-ink">
              <span>Total Invoice:</span>
              <span className="font-mono">${invoice.totalAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-ink-muted">
              <span>Amount Paid:</span>
              <span className="font-mono text-emerald-600 font-medium">
                ${invoice.amountPaid.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border text-ink">
              <span>Balance Due:</span>
              <span className="font-mono text-accent">${invoice.amountDue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment History on this Invoice */}
        {invoice.payments.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
              Payment Receipts Applied
            </h3>
            <PaymentHistoryTable payments={invoice.payments} />
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="p-3.5 rounded-lg bg-paper-2 border border-border text-xs text-ink-muted">
            <span className="font-semibold text-ink block mb-1">Notes & Terms:</span>
            <p>{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

