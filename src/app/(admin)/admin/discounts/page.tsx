"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DiscountFormDialog } from "@/components/discounts/DiscountFormDialog";
import {
  toggleDiscountActiveAction,
  deleteDiscountAction,
} from "@/server/actions/discount";
import {
  Tag,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Power,
  Percent,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DiscountItem {
  id: string;
  name: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  scope: "ENTIRE_SUBSCRIPTION" | "SPECIFIC_PRODUCTS";
  value: number;
  minPurchaseAmount: number | null;
  minQuantity: number | null;
  startDate: string | null;
  endDate: string | null;
  maxUsageCount: number | null;
  currentUsageCount: number;
  productId: string | null;
  isActive: boolean;
  status: "ACTIVE" | "EXPIRED" | "EXHAUSTED" | "SCHEDULED" | "INACTIVE";
  product: { id: string; name: string } | null;
  _count: { redemptions: number };
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = React.useState<DiscountItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState("ALL");
  const [typeFilter, setTypeFilter] = React.useState("ALL");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingDiscount, setEditingDiscount] = React.useState<DiscountItem | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [discountToDelete, setDiscountToDelete] = React.useState<DiscountItem | null>(null);

  const fetchDiscounts = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (scopeFilter !== "ALL") params.set("scope", scopeFilter);
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const res = await fetch(`/api/discounts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load discounts");
      const data = await res.json();
      setDiscounts(data.discounts || []);
    } catch {
      toast.error("Could not fetch discount rules");
    } finally {
      setLoading(false);
    }
  }, [search, scopeFilter, typeFilter]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchDiscounts();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchDiscounts]);

  const handleToggleActive = async (discount: DiscountItem) => {
    try {
      const result = await toggleDiscountActiveAction(discount.id, !discount.isActive);
      if (result.success) {
        toast.success(result.message);
        fetchDiscounts();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to toggle discount status");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!discountToDelete) return;
    try {
      const result = await deleteDiscountAction(discountToDelete.id);
      if (result.success) {
        toast.success(result.message);
        fetchDiscounts();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete discount rule");
    } finally {
      setDeleteDialogOpen(false);
      setDiscountToDelete(null);
    }
  };

  // KPIs
  const totalCount = discounts.length;
  const activeCount = discounts.filter((d) => d.status === "ACTIVE").length;
  const totalRedemptions = discounts.reduce((sum, d) => sum + (d._count?.redemptions || 0), 0);
  const expiredOrExhausted = discounts.filter(
    (d) => d.status === "EXPIRED" || d.status === "EXHAUSTED"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discount Rules"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Discounts" },
        ]}
        actions={
          <Button
            onClick={() => {
              setEditingDiscount(null);
              setFormOpen(true);
            }}
            className="bg-accent text-white hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Discount
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Discount Rules"
          value={totalCount}
          icon={Tag}
          subtitle="Configured in catalog"
        />
        <KpiCard
          title="Active & Redeemable"
          value={activeCount}
          icon={CheckCircle2}
          subtitle="Available for checkout"
        />
        <KpiCard
          title="Total Redemptions"
          value={totalRedemptions}
          icon={Percent}
          subtitle="Lifetime usages"
        />
        <KpiCard
          title="Expired / Exhausted"
          value={expiredOrExhausted}
          icon={AlertCircle}
          subtitle="Capped or past date"
        />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <Input
            placeholder="Search code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-paper"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="h-10 px-3 rounded-md bg-paper border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="ALL">All Scopes</option>
            <option value="ENTIRE_SUBSCRIPTION">Entire Subscription</option>
            <option value="SPECIFIC_PRODUCTS">Specific Product</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 px-3 rounded-md bg-paper border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="ALL">All Types</option>
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-lg border border-border bg-paper overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading discount rules...</div>
        ) : discounts.length === 0 ? (
          <EmptyState
            title="No discount rules found"
            description="Create promotional codes or volume discount rules for subscriptions."
            action={
              <Button
                onClick={() => {
                  setEditingDiscount(null);
                  setFormOpen(true);
                }}
                size="sm"
                className="bg-accent text-white hover:bg-accent/90"
              >
                Create Discount
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Rule Name</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Scope / Product</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {discounts.map((discount) => (
                  <tr key={discount.id} className="hover:bg-paper-2/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-accent">
                      <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                        {discount.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-ink">
                      <div>{discount.name}</div>
                      {discount.minPurchaseAmount && (
                        <span className="text-xs text-ink-muted">
                          Min. ${Number(discount.minPurchaseAmount).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-ink">
                      {discount.type === "PERCENTAGE" ? (
                        <span>{discount.value}% Off</span>
                      ) : (
                        <span>${Number(discount.value).toFixed(2)} Off</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">
                      {discount.scope === "ENTIRE_SUBSCRIPTION" ? (
                        <span className="px-2 py-0.5 rounded bg-paper-3">Entire Sub</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-paper-3 font-medium text-ink">
                          {discount.product?.name || "Product"}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-sm font-mono text-ink-muted">
                      {discount.currentUsageCount}
                      {discount.maxUsageCount ? ` / ${discount.maxUsageCount}` : " (Unlimited)"}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={discount.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-paper border border-border">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingDiscount(discount);
                              setFormOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit Rule
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(discount)}>
                            <Power className="h-4 w-4 mr-2" />
                            {discount.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950"
                            onClick={() => {
                              setDiscountToDelete(discount);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete / Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <DiscountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        discountToEdit={editingDiscount}
        onSuccess={fetchDiscounts}
      />

      {/* Delete/Archive Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remove Discount Rule"
        description={`Are you sure you want to remove discount '${discountToDelete?.code}'? If redemptions exist, it will be safely deactivated to preserve financial audit history.`}
        confirmLabel="Confirm"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
