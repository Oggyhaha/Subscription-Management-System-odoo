import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { Repeat, Receipt, CreditCard, ShieldCheck } from "lucide-react";

export default function CustomerDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Customer portal"
        description="View your active Brightloop subscriptions, payment receipts, and billing history"
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="My subscriptions"
            value="--"
            subtitle="Active recurring plans"
            icon={Repeat}
          />
          <KpiCard
            title="Upcoming renewal"
            value="--"
            subtitle="Next billing cycle date"
            icon={ShieldCheck}
          />
          <KpiCard
            title="Open balance"
            value="--"
            subtitle="Current unpaid statements"
            icon={Receipt}
          />
          <KpiCard
            title="Recent payments"
            value="--"
            subtitle="Reconciled transactions"
            icon={CreditCard}
          />
        </div>
      </div>
    </div>
  );
}
