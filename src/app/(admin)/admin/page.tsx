import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { Repeat, Receipt, DollarSign, Users } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Admin dashboard"
        description="Global system telemetry, subscription lifecycle health, and revenue tracking"
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Active subscriptions"
            value="--"
            subtitle="Dev A will connect live aggregation in Hour 2"
            icon={Repeat}
          />
          <KpiCard
            title="Collected revenue"
            value="--"
            subtitle="Pending database seed & reporting service"
            icon={DollarSign}
          />
          <KpiCard
            title="Overdue balance"
            value="--"
            subtitle="Calculated server-side via Decimal"
            icon={Receipt}
          />
          <KpiCard
            title="Total customers"
            value="--"
            subtitle="Scoped to Brightloop tenant"
            icon={Users}
          />
        </div>
      </div>
    </div>
  );
}
