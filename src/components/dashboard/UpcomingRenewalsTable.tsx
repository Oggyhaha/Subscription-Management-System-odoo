import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Calendar, ArrowRight } from "lucide-react";

interface RenewalItem {
  id: string;
  nextBillingDate: Date | string | null;
  totalAmount: number;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  plan: {
    id: string;
    name: string;
  };
}

interface UpcomingRenewalsTableProps {
  renewals: RenewalItem[];
}

export function UpcomingRenewalsTable({ renewals }: UpcomingRenewalsTableProps) {
  if (!renewals || renewals.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-rule bg-card p-6 text-center text-sm text-muted-foreground">
        <Calendar className="mb-2 h-6 w-6 opacity-40" />
        No upcoming renewals scheduled in the next 30 days.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-rule bg-paper-2 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="py-2.5 px-4">Customer</th>
            <th className="py-2.5 px-4">Plan</th>
            <th className="py-2.5 px-4">Renewal Date</th>
            <th className="py-2.5 px-4 text-right">Amount</th>
            <th className="py-2.5 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {renewals.map((r) => (
            <tr key={r.id} className="hover:bg-paper-3/40 transition-colors">
              <td className="py-2.5 px-4">
                <div className="font-medium text-foreground">{r.customer.name}</div>
                <div className="text-xs text-muted-foreground">{r.customer.email}</div>
              </td>
              <td className="py-2.5 px-4 text-foreground font-medium text-xs">
                {r.plan.name}
              </td>
              <td className="py-2.5 px-4 tabular-nums text-xs text-muted-foreground">
                {r.nextBillingDate ? formatDate(new Date(r.nextBillingDate)) : "—"}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-foreground">
                {formatMoney(r.totalAmount)}
              </td>
              <td className="py-2.5 px-4 text-right">
                <Link
                  href={`/admin/subscriptions/${r.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  View
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
