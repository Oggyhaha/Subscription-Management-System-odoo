"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { MoneyText } from "@/components/shared/MoneyText";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProductService } from "@/server/services/product";

interface VariantRow {
  id: string;
  name: string;
  sku?: string | null;
  priceModifier: any;
  attributeName: string;
  attributeValue: string;
  isActive: boolean;
  product: {
    id: string;
    name: string;
    salesPrice: any;
  };
}

export default function AdminProductVariantsPage() {
  const [variants, setVariants] = React.useState<VariantRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/variants?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const json = await res.json();
        setVariants(json.data || []);
      } else {
        setVariants([]);
      }
    } catch {
      setVariants([]);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const columns: ColumnDef<VariantRow>[] = [
    {
      accessorKey: "name",
      header: "Variant Name",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">{row.original.name}</div>
          <div className="text-xs text-muted-foreground font-mono">
            {row.original.attributeName}: {row.original.attributeValue}
            {row.original.sku && ` · SKU: ${row.original.sku}`}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "product",
      header: "Parent Product",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <span className="font-medium text-foreground">{row.original.product.name}</span>
          <div className="text-xs text-muted-foreground">
            Base: <MoneyText amount={row.original.product.salesPrice} />
          </div>
        </div>
      ),
    },
    {
      accessorKey: "priceModifier",
      header: "Price Adjustment",
      cell: ({ row }) => (
        <MoneyText amount={row.original.priceModifier} showPositiveSign />
      ),
    },
    {
      id: "effectivePrice",
      header: "Effective Unit Price",
      cell: ({ row }) => {
        const effective = ProductService.calculateEffectivePrice(
          row.original.product.salesPrice,
          row.original.priceModifier
        );
        return <MoneyText amount={effective} className="font-semibold text-primary" />;
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.isActive ? "active" : "cancelled"} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product variants"
        description="Global catalog of variant price adjustments, editions, and license tiers"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Products", href: "/admin/products" },
          { label: "Variants" },
        ]}
      />

      <div className="px-6 pb-6">
        <DataTable
          columns={columns}
          data={variants}
          pageCount={1}
          searchPlaceholder="Search variants by name, attribute, or SKU..."
          searchValue={search}
          onSearchChange={setSearch}
          isLoading={isLoading}
          emptyTitle="No product variants defined"
          emptyDescription="Add variants from the Products catalog to configure price adjustments."
        />
      </div>
    </div>
  );
}

