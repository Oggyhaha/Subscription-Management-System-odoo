"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { TaxFormDialog } from "@/components/catalog/TaxFormDialog";
import { TaxCalculatorCard } from "@/components/catalog/TaxCalculatorCard";
import { toggleTaxRuleArchiveAction } from "@/server/actions/catalog";
import { Plus, Edit2, Archive, Check } from "lucide-react";
import { toast } from "sonner";

interface TaxRuleRow {
  id: string;
  name: string;
  rate: any;
  country?: string | null;
  state?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export default function AdminTaxesPage() {
  const [taxes, setTaxes] = React.useState<TaxRuleRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = React.useState(1);

  // Dialog states
  const [formOpen, setFormOpen] = React.useState(false);
  const [selectedRuleForEdit, setSelectedRuleForEdit] = React.useState<TaxRuleRow | null>(null);

  const [confirmArchiveOpen, setConfirmArchiveOpen] = React.useState(false);
  const [ruleToArchive, setRuleToArchive] = React.useState<TaxRuleRow | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/taxes?page=${pagination.pageIndex + 1}&pageSize=${pagination.pageSize}&search=${encodeURIComponent(
          search
        )}`
      );
      if (res.ok) {
        const json = await res.json();
        setTaxes(json.data || []);
        setPageCount(json.pagination?.pageCount || 1);
      } else {
        setTaxes([]);
      }
    } catch {
      setTaxes([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleArchiveConfirm = async () => {
    if (!ruleToArchive) return;
    try {
      const res = await toggleTaxRuleArchiveAction(ruleToArchive.id, !ruleToArchive.isActive);
      if (!res.success) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      toast.success(
        ruleToArchive.isActive ? "Tax rule archived" : "Tax rule reactivated"
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const columns: ColumnDef<TaxRuleRow>[] = [
    {
      accessorKey: "name",
      header: "Tax Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{row.original.name}</span>
          {row.original.isDefault && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Default
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "rate",
      header: "Rate",
      cell: ({ row }) => {
        const rateNum = Number(row.original.rate);
        const displayPercent = rateNum <= 1 ? (rateNum * 100).toFixed(2) : String(rateNum);
        return <span className="font-mono font-medium">{displayPercent}%</span>;
      },
    },
    {
      accessorKey: "region",
      header: "Region / Country",
      cell: ({ row }) => {
        const country = !row.original.country || row.original.country === "US" ? "India" : row.original.country;
        const state = row.original.state === "TX" ? "MH" : row.original.state;
        return (
          <span className="text-xs text-muted-foreground font-medium">
            {country}
            {state ? ` (${state})` : ""}
          </span>
        );
      },
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
              setSelectedRuleForEdit(row.original);
              setFormOpen(true);
            }}
            title="Edit rule"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setRuleToArchive(row.original);
              setConfirmArchiveOpen(true);
            }}
            title={row.original.isActive ? "Archive rule" : "Reactivate rule"}
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
        title="Tax configuration"
        description="Configure dynamic tax rules, regional rates, and calculate taxes with Decimal precision"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Taxes" },
        ]}
        actions={
          <Button
            onClick={() => {
              setSelectedRuleForEdit(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Tax Rule
          </Button>
        }
      />

      <div className="px-6 space-y-6 pb-6">
        <TaxCalculatorCard />

        <DataTable
          columns={columns}
          data={taxes}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          searchPlaceholder="Search tax rules..."
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          isLoading={isLoading}
          emptyTitle="No tax rules configured"
          emptyDescription="Add a tax rule to configure VAT, GST, or regional sales taxes."
        />
      </div>

      <TaxFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        ruleToEdit={selectedRuleForEdit}
        onSuccess={loadData}
      />

      <ConfirmDialog
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        title={ruleToArchive?.isActive ? "Archive Tax Rule" : "Reactivate Tax Rule"}
        description={
          ruleToArchive?.isActive
            ? `Archive "${ruleToArchive?.name}"? New invoices will not use this rule unless reactivated.`
            : `Reactivate "${ruleToArchive?.name}"?`
        }
        confirmLabel={ruleToArchive?.isActive ? "Archive" : "Reactivate"}
        variant={ruleToArchive?.isActive ? "destructive" : "default"}
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}

