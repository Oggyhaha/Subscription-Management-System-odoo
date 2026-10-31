"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { MoneyText } from "@/components/shared/MoneyText";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/components/catalog/ProductFormDialog";
import { ProductVariantsDialog } from "@/components/catalog/ProductVariantsDialog";
import { toggleProductArchiveAction } from "@/server/actions/catalog";
import { ProductType } from "@/schemas/catalog";
import { Plus, Edit2, Layers, Archive, Check } from "lucide-react";
import { toast } from "sonner";

interface ProductRow {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: any;
  costPrice: any;
  notes?: string | null;
  isActive: boolean;
  variants: any[];
  _count?: { variants: number };
}

export default function AdminProductsPage() {
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = React.useState(1);

  // Dialog states
  const [formOpen, setFormOpen] = React.useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = React.useState<ProductRow | null>(null);

  const [variantsOpen, setVariantsOpen] = React.useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = React.useState<ProductRow | null>(null);

  const [confirmArchiveOpen, setConfirmArchiveOpen] = React.useState(false);
  const [productToArchive, setProductToArchive] = React.useState<ProductRow | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/products?page=${pagination.pageIndex + 1}&pageSize=${pagination.pageSize}&search=${encodeURIComponent(
          search
        )}`
      );
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
        setPageCount(json.pagination?.pageCount || 1);
      } else {
        // Fallback for static mock if API endpoint is not yet mounted
        setProducts([]);
      }
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleArchiveConfirm = async () => {
    if (!productToArchive) return;
    try {
      const res = await toggleProductArchiveAction(productToArchive.id, !productToArchive.isActive);
      if (!res.success) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      toast.success(
        productToArchive.isActive ? "Product archived successfully" : "Product reactivated"
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const columns: ColumnDef<ProductRow>[] = [
    {
      accessorKey: "name",
      header: "Product Name",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">{row.original.name}</div>
          {row.original.notes && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {row.original.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="rounded bg-paper-3 px-2 py-0.5 text-xs font-medium text-foreground">
          {row.original.type}
        </span>
      ),
    },
    {
      accessorKey: "salesPrice",
      header: "Sales Price",
      cell: ({ row }) => <MoneyText amount={row.original.salesPrice} />,
    },
    {
      accessorKey: "costPrice",
      header: "Cost Price",
      cell: ({ row }) => (
        <MoneyText amount={row.original.costPrice} className="text-muted-foreground font-normal" />
      ),
    },
    {
      accessorKey: "variants",
      header: "Variants",
      cell: ({ row }) => {
        const count = row.original._count?.variants ?? row.original.variants?.length ?? 0;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProductForVariants(row.original);
              setVariantsOpen(true);
            }}
            className="h-7 gap-1 text-xs text-primary hover:bg-primary/10"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{count} {count === 1 ? "variant" : "variants"}</span>
          </Button>
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
              setSelectedProductForEdit(row.original);
              setFormOpen(true);
            }}
            title="Edit product"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setProductToArchive(row.original);
              setConfirmArchiveOpen(true);
            }}
            title={row.original.isActive ? "Archive product" : "Reactivate product"}
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
        title="Products & variants"
        description="Manage software editions, billable recurring licenses, services, and pricing models"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Products" },
        ]}
        actions={
          <Button
            onClick={() => {
              setSelectedProductForEdit(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Product
          </Button>
        }
      />

      <div className="px-6 pb-6">
        <DataTable
          columns={columns}
          data={products}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          searchPlaceholder="Search products by name..."
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          isLoading={isLoading}
          emptyTitle="No products defined"
          emptyDescription="Create your first software product or billable service to get started."
        />
      </div>

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        productToEdit={selectedProductForEdit}
        onSuccess={loadData}
      />

      {/* Variants Dialog */}
      <ProductVariantsDialog
        open={variantsOpen}
        onOpenChange={setVariantsOpen}
        product={selectedProductForVariants}
        onVariantsUpdated={loadData}
      />

      {/* Confirm Archive Dialog */}
      <ConfirmDialog
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        title={productToArchive?.isActive ? "Archive Product" : "Reactivate Product"}
        description={
          productToArchive?.isActive
            ? `Are you sure you want to archive "${productToArchive?.name}"? It will no longer be available for new quotations or subscriptions.`
            : `Reactivate "${productToArchive?.name}" and make it available in the product catalog?`
        }
        confirmLabel={productToArchive?.isActive ? "Archive" : "Reactivate"}
        variant={productToArchive?.isActive ? "destructive" : "default"}
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}

