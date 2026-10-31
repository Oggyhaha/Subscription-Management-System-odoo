"use client";

import * as React from "react";
import { MoneyText } from "@/components/shared/MoneyText";
import { CreditCard, Banknote, Building2, CheckSquare, Receipt, ArrowDownRight } from "lucide-react";

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentDate: string | Date;
  paymentMethod: string;
  amount: number;
  referenceNote?: string | null;
}

interface PaymentHistoryTableProps {
  payments: PaymentRecord[];
  isLoading?: boolean;
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case "BANK_TRANSFER":
      return "Bank Transfer";
    case "CREDIT_CARD":
      return "Credit Card";
    case "ACH":
      return "ACH Debit";
    case "CASH":
      return "Cash";
    case "CHECK":
      return "Cheque";
    default:
      return method;
  }
}

export function PaymentHistoryTable({ payments, isLoading = false }: PaymentHistoryTableProps) {
  if (isLoading) {
    return <div className="p-4 text-center text-xs text-ink-muted">Loading payment records...</div>;
  }

  if (payments.length === 0) {
    return (
      <div className="p-6 text-center rounded-lg border border-dashed border-border bg-paper/50">
        <Receipt className="h-8 w-8 text-ink-muted mx-auto mb-2 opacity-60" />
        <p className="text-sm font-medium text-ink">No payments recorded yet</p>
        <p className="text-xs text-ink-muted mt-0.5">
          Payments applied to this invoice will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-paper overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-ink">
          <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
            <tr>
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Payment #</th>
              <th className="py-2.5 px-3">Method</th>
              <th className="py-2.5 px-3">Reference / Memo</th>
              <th className="py-2.5 px-3 text-right">Amount Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-paper-2/40 transition-colors">
                <td className="py-2.5 px-3 font-mono text-ink-muted">
                  {new Date(p.paymentDate).toLocaleDateString()}
                </td>
                <td className="py-2.5 px-3 font-mono font-medium text-accent">
                  <span className="px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20">
                    {p.paymentNumber}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded bg-paper-3 font-medium text-ink">
                    {formatPaymentMethod(p.paymentMethod)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-ink-muted">
                  {p.referenceNote || "—"}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center justify-end gap-1">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    <span>+${Number(p.amount).toFixed(2)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

