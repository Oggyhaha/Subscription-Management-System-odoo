import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DollarSign, ArrowRight } from "lucide-react";

interface PaymentItem {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date | string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
  };
}

interface RecentPaymentsTableProps {
  payments: PaymentItem[];
}

export function RecentPaymentsTable({ payments }: RecentPaymentsTableProps) {
  if (!payments || payments.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-rule bg-card p-6 text-center text-sm text-muted-foreground">
        <DollarSign className="mb-2 h-6 w-6 opacity-40" />
        No cash receipts recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-rule bg-paper-2 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="py-2.5 px-4">Customer</th>
            <th className="py-2.5 px-4">Invoice</th>
            <th className="py-2.5 px-4">Method</th>
            <th className="py-2.5 px-4">Date</th>
            <th className="py-2.5 px-4 text-right">Amount</th>
            <th className="py-2.5 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-paper-3/40 transition-colors">
              <td className="py-2.5 px-4">
                <div className="font-medium text-foreground">{p.customer.name}</div>
                <div className="text-xs text-muted-foreground">{p.customer.email}</div>
              </td>
              <td className="py-2.5 px-4 text-foreground font-medium text-xs">
                {p.invoice.invoiceNumber}
              </td>
              <td className="py-2.5 px-4 text-xs">
                <StatusBadge status={p.paymentMethod} />
              </td>
              <td className="py-2.5 px-4 tabular-nums text-xs text-muted-foreground">
                {formatDate(new Date(p.paymentDate))}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatMoney(p.amount)}
              </td>
              <td className="py-2.5 px-4 text-right">
                <Link
                  href={`/admin/payments?search=${encodeURIComponent(p.invoice.invoiceNumber)}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  Details
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
