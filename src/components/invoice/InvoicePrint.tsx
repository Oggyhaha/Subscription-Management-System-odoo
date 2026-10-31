"use client";

import * as React from "react";
import { MoneyText } from "@/components/shared/MoneyText";
import { formatDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface InvoicePrintProps {
  invoice: any;
  basePath?: string;
}

export function InvoicePrint({ invoice, basePath = "/admin" }: InvoicePrintProps) {
  const customer = invoice.customer;
  const user = customer?.user;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-paper p-6 md:p-12 print:p-0 print:bg-white text-ink">
      {/* Screen-only top action bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`${basePath}/invoices/${invoice.id}`}
          className="text-xs text-muted-foreground hover:text-ink flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoice Details
        </Link>
        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} size="sm" className="gap-2">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div className="max-w-4xl mx-auto bg-card border border-rule print:border-none p-8 md:p-12 rounded-lg print:rounded-none shadow-sm print:shadow-none space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-rule pb-8">
          <div>
            <span className="font-mono text-xs text-muted-foreground tracking-wider uppercase">Brightloop Software Inc.</span>
            <h1 className="text-2xl font-bold tracking-tight text-ink mt-1">INVOICE</h1>
            <p className="font-mono text-sm text-ink-muted mt-1">{invoice.invoiceNumber}</p>
          </div>
          <div className="text-left md:text-right space-y-1">
            <div className="inline-block print:hidden mb-2">
              <StatusBadge status={invoice.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-ink">Issue Date:</span> {formatDate(invoice.issueDate)}
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-ink">Due Date:</span> {formatDate(invoice.dueDate)}
            </div>
            {invoice.cycleKey && (
              <div className="text-[11px] font-mono text-muted-foreground">
                Cycle: {invoice.cycleKey}
              </div>
            )}
          </div>
        </div>

        {/* Bill To & Company Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Billed To:</h2>
            <div className="font-medium text-ink text-base">{customer?.name || user?.name || "Valued Customer"}</div>
            {customer?.contactName && <div className="text-ink-muted text-xs mt-0.5">{customer.contactName}</div>}
            {(user?.email || customer?.email) && (
              <div className="text-muted-foreground text-xs font-mono mt-1">{user?.email || customer?.email}</div>
            )}
            {(customer?.addressLine1 || customer?.city) && (
              <div className="text-muted-foreground text-xs mt-1">
                {[customer.addressLine1, customer.city, customer.state, customer.postalCode, customer.country]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
            {customer?.taxIdentifier && (
              <div className="text-[11px] text-muted-foreground mt-1">Tax ID / VAT: {customer.taxIdentifier}</div>
            )}
          </div>

          <div className="md:text-right text-xs text-muted-foreground space-y-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-2">Brightloop Software Inc.</h2>
            <div>100 Enterprise Way, Suite 400</div>
            <div>San Francisco, CA 94107</div>
            <div>billing@brightloop.io</div>
            <div className="font-mono pt-1 text-[11px]">EIN: 88-1294819</div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-rule rounded-md overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-2 border-b border-rule font-medium text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3">Item & Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Tax</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule font-mono">
              {invoice.items.map((item: any) => (
                <tr key={item.id} className="hover:bg-paper-1">
                  <td className="py-3 px-3 font-sans">
                    <div className="font-medium text-ink">{item.description}</div>
                    {item.variant && (
                      <div className="text-[11px] text-muted-foreground">Variant: {item.variant.name}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">{item.quantity}</td>
                  <td className="py-3 px-3 text-right">
                    <MoneyText amount={item.unitPrice} />
                  </td>
                  <td className="py-3 px-3 text-right text-ink-muted">
                    {Number(item.discountAmount) > 0 ? (
                      <span>-<MoneyText amount={item.discountAmount} /></span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-ink-muted">
                    {Number(item.taxAmount) > 0 ? (
                      <MoneyText amount={item.taxAmount} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-ink">
                    <MoneyText amount={item.lineTotal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 pt-2">
          <div className="text-xs text-muted-foreground max-w-sm space-y-2">
            <div className="font-medium text-ink">Payment Instructions & Terms:</div>
            <p>
              Please remit payment within agreed terms. Bank transfers, automated clearing house (ACH), and major credit cards accepted.
            </p>
            {invoice.subscription && (
              <p className="font-mono text-[11px]">
                Linked Contract: {invoice.subscription.subscriptionNumber} ({invoice.subscription.plan?.name || "Subscription"})
              </p>
            )}
          </div>

          <div className="w-full md:w-72 space-y-2 text-xs">
            <div className="flex justify-between py-1 text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono text-ink">
                <MoneyText amount={invoice.subtotal} />
              </span>
            </div>
            {Number(invoice.discountTotal) > 0 && (
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Discounts Applied</span>
                <span className="font-mono text-status-activeFg">
                  -<MoneyText amount={invoice.discountTotal} />
                </span>
              </div>
            )}
            <div className="flex justify-between py-1 text-muted-foreground">
              <span>Estimated Taxes</span>
              <span className="font-mono text-ink">
                <MoneyText amount={invoice.taxTotal} />
              </span>
            </div>
            <div className="flex justify-between py-2 border-t border-b border-rule font-semibold text-sm text-ink">
              <span>Total Amount</span>
              <span className="font-mono">
                <MoneyText amount={invoice.totalAmount} />
              </span>
            </div>
            <div className="flex justify-between py-1 text-muted-foreground">
              <span>Amount Paid</span>
              <span className="font-mono text-ink">
                <MoneyText amount={invoice.amountPaid} />
              </span>
            </div>
            <div className="flex justify-between py-2 bg-paper-2 px-2.5 rounded font-bold text-sm text-ink">
              <span>Balance Due</span>
              <span className="font-mono">
                <MoneyText amount={invoice.amountDue} />
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-rule pt-6 text-center text-xs text-muted-foreground">
          <p>Thank you for choosing Brightloop Software! For billing inquiries, contact support@brightloop.io.</p>
        </div>
      </div>
    </div>
  );
}
