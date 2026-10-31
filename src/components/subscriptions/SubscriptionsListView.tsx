"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/dates";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, ArrowRight, RefreshCw } from "lucide-react";
import { processAutoClosuresAction } from "@/server/actions/subscription";

interface SubscriptionRow {
  id: string;
  subscriptionNumber: string;
  status: string;
  billingInterval: string;
  currentPeriodStart: Date | string;
  currentPeriodEnd: Date | string;
  nextBillingDate: Date | string | null;
  totalAmount: any;
  customer: { id: string; name: string; email: string };
  plan: { id: string; name: string };
  _count: { invoices: number };
}

interface SubscriptionsListViewProps {
  subscriptions: SubscriptionRow[];
  basePath?: string; // "/admin" or "/staff"
}

export function SubscriptionsListView({
  subscriptions,
  basePath = "/admin",
}: SubscriptionsListViewProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [isProcessing, setIsProcessing] = React.useState(false);

  const filteredData = React.useMemo(() => {
    if (statusFilter === "ALL") return subscriptions;
    return subscriptions.filter((s) => s.status === statusFilter);
  }, [subscriptions, statusFilter]);

  const handleProcessAutoClosures = async () => {
    setIsProcessing(true);
    try {
      await processAutoClosuresAction();
      router.refresh();
    } finally {
      setIsProcessing(false);
    }
  };

  const columns: ColumnDef<SubscriptionRow>[] = [
    {
      accessorKey: "subscriptionNumber",
      header: "Subscription #",
      cell: ({ row }) => (
        <Link
          href={`${basePath}/subscriptions/${row.original.id}`}
          className="font-mono text-sm font-medium text-primary hover:underline"
        >
          {row.original.subscriptionNumber}
        </Link>
      ),
    },
    {
      accessorKey: "customer.name",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-foreground">{row.original.customer?.name || "Customer"}</div>
          <div className="text-xs text-muted-foreground">{row.original.customer?.email || ""}</div>
        </div>
      ),
    },
    {
      accessorKey: "plan.name",
      header: "Plan & Cycle",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.plan?.name || "Standard Plan"}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {row.original.billingInterval ? row.original.billingInterval.toLowerCase() : "monthly"}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "currentPeriodEnd",
      header: "Current Period",
      cell: ({ row }) => (
        <div className="text-xs">
          <div>{formatDate(row.original.currentPeriodStart)}</div>
          <div className="text-muted-foreground">to {formatDate(row.original.currentPeriodEnd)}</div>
        </div>
      ),
    },
    {
      accessorKey: "nextBillingDate",
      header: "Next Billing",
      cell: ({ row }) =>
        row.original.nextBillingDate ? formatDate(row.original.nextBillingDate) : "—",
    },
    {
      accessorKey: "totalAmount",
      header: "Recurring Amount",
      cell: ({ row }) => (
        <span className="font-semibold text-foreground">
          <MoneyText amount={row.original.totalAmount} />
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
          <Link href={`${basePath}/subscriptions/${row.original.id}`}>
            Manage <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Active recurring contracts, automated billing intervals, and subscription lifecycle management."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleProcessAutoClosures}
              disabled={isProcessing}
              className="h-9 gap-1.5 text-xs text-muted-foreground"
              title="Check and close subscriptions that reached period end"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? "animate-spin" : ""}`} />
              Run Auto-Close
            </Button>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="QUOTATION">Quotation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <DataTable columns={columns} data={filteredData} searchPlaceholder="Search subscriptions..." />
    </div>
  );
}

