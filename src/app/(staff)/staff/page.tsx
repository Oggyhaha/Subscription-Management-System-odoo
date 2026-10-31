import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { Users, FileSpreadsheet, AlertTriangle, Receipt } from "lucide-react";

export default function StaffDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Operations dashboard"
        description="Daily quotation workflow, customer subscriptions, and overdue invoice tracking"
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Assigned customers"
            value="--"
            subtitle="Staff scoped operations"
            icon={Users}
          />
          <KpiCard
            title="Open quotations"
            value="--"
            subtitle="Draft and sent offers"
            icon={FileSpreadsheet}
          />
          <KpiCard
            title="Pending invoices"
            value="--"
            subtitle="Awaiting customer settlement"
            icon={Receipt}
          />
          <KpiCard
            title="Overdue alerts"
            value="--"
            subtitle="Actionable follow-up queue"
            icon={AlertTriangle}
          />
        </div>
      </div>
    </div>
  );
}
