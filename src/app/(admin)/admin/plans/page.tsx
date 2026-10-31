"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { MoneyText } from "@/components/shared/MoneyText";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { PlanFormDialog } from "@/components/catalog/PlanFormDialog";
import { togglePlanArchiveAction } from "@/server/actions/catalog";
import { BillingInterval } from "@/schemas/catalog";
import { Plus, Edit2, Archive, Check, Pause, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

interface PlanRow {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  price: any;
  billingInterval: BillingInterval;
  minQuantity: number;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  autoCloseAtEnd: boolean;
  allowEarlyClose: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  isActive: boolean;
  _count?: { subscriptions: number };
}

export default function AdminPlansPage() {
  const [plans, setPlans] = React.useState<PlanRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = React.useState(1);

  // Dialog states
  const [formOpen, setFormOpen] = React.useState(false);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = React.useState<PlanRow | null>(null);

  const [confirmArchiveOpen, setConfirmArchiveOpen] = React.useState(false);
  const [planToArchive, setPlanToArchive] = React.useState<PlanRow | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/plans?page=${pagination.pageIndex + 1}&pageSize=${pagination.pageSize}&search=${encodeURIComponent(
          search
        )}`
      );
      if (res.ok) {
        const json = await res.json();
        setPlans(json.data || []);
        setPageCount(json.pagination?.pageCount || 1);
      } else {
        setPlans([]);
      }
    } catch {
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleArchiveConfirm = async () => {
    if (!planToArchive) return;
    try {
      const res = await togglePlanArchiveAction(planToArchive.id, !planToArchive.isActive);
      if (!res.success) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      toast.success(
        planToArchive.isActive ? "Plan archived successfully" : "Plan reactivated"
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const columns: ColumnDef<PlanRow>[] = [
    {
      accessorKey: "name",
      header: "Plan Name",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">{row.original.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.code}</div>
        </div>
      ),
    },
    {
      accessorKey: "price",
      header: "Price / Interval",
      cell: ({ row }) => (
        <div className="flex items-baseline gap-1">
          <MoneyText amount={row.original.price} />
          <span className="text-xs text-muted-foreground lowercase">
            /{row.original.billingInterval}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "minQuantity",
      header: "Min Qty",
      cell: ({ row }) => (
        <span className="text-xs font-mono">{row.original.minQuantity}</span>
      ),
    },
    {
      id: "permissions",
      header: "Rules",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          {row.original.allowPause && (
            <span title="Pause allowed" className="inline-flex items-center text-xs">
              <Pause className="h-3.5 w-3.5 text-amber-600" />
            </span>
          )}
          {row.original.allowRenewal && (
            <span title="Renewal allowed" className="inline-flex items-center text-xs">
              <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
            </span>
          )}
          {row.original.allowEarlyClose && (
            <span title="Early close allowed" className="inline-flex items-center text-xs">
              <XCircle className="h-3.5 w-3.5 text-rose-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.isActive ? "active" : "cancelled"} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelectedPlanForEdit(row.original);
              setFormOpen(true);
            }}
            title="Edit plan"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setPlanToArchive(row.original);
              setConfirmArchiveOpen(true);
            }}
            title={row.original.isActive ? "Archive plan" : "Reactivate plan"}
          >
            {row.original.isActive ? (
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription plans"
        description="Define recurring billing cycles, minimum seat quantities, and lifecycle policies"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Plans" },
        ]}
        actions={
          <Button
            onClick={() => {
              setSelectedPlanForEdit(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Plan
          </Button>
        }
      />

      <div className="px-6 pb-6">
        <DataTable
          columns={columns}
          data={plans}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          searchPlaceholder="Search plans by name or code..."
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          isLoading={isLoading}
          emptyTitle="No plans configured"
          emptyDescription="Create your first subscription plan with recurring billing intervals."
        />
      </div>

      <PlanFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        planToEdit={selectedPlanForEdit}
        onSuccess={loadData}
      />

      <ConfirmDialog
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        title={planToArchive?.isActive ? "Archive Plan" : "Reactivate Plan"}
        description={
          planToArchive?.isActive
            ? `Archive "${planToArchive?.name}"? New subscriptions will no longer be permitted on this plan.`
            : `Reactivate "${planToArchive?.name}"?`
        }
        confirmLabel={planToArchive?.isActive ? "Archive" : "Reactivate"}
        variant={planToArchive?.isActive ? "destructive" : "default"}
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}

