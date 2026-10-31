"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { CustomerFormDialog } from "@/components/catalog/CustomerFormDialog";
import { Plus, Edit2, ArrowRight, UserCheck } from "lucide-react";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  taxIdentifier?: string | null;
  createdAt: string | Date;
  user?: { id: string; role: string } | null;
  _count?: {
    subscriptions: number;
    invoices: number;
    quotations: number;
  };
}

export interface CustomersViewProps {
  basePath: "/admin/customers" | "/staff/customers";
  role: "admin" | "staff";
}

export function CustomersView({ basePath, role }: CustomersViewProps) {
  const router = useRouter();
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [pageCount, setPageCount] = React.useState(1);

  const [formOpen, setFormOpen] = React.useState(false);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = React.useState<CustomerRow | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/customers?page=${pagination.pageIndex + 1}&pageSize=${pagination.pageSize}&search=${encodeURIComponent(
          search
        )}`
      );
      if (res.ok) {
        const json = await res.json();
        setCustomers(json.data || []);
        setPageCount(json.pagination?.pageCount || 1);
      } else {
        setCustomers([]);
      }
    } catch {
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, search]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const columns: ColumnDef<CustomerRow>[] = [
    {
      accessorKey: "name",
      header: "Customer / Organization",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <span>{row.original.name}</span>
            {row.original.user && (
              <span title="Linked web login account">
                <UserCheck className="h-3 w-3 text-emerald-600" />
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {[row.original.city, row.original.state, row.original.country]
            .filter(Boolean)
            .join(", ") || "--"}
        </span>
      ),
    },
    {
      accessorKey: "taxIdentifier",
      header: "Tax ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.taxIdentifier || "--"}
        </span>
      ),
    },
    {
      id: "stats",
      header: "Activity",
      cell: ({ row }) => {
        const counts = row.original._count;
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span title="Active Subscriptions">
              <strong className="text-foreground">{counts?.subscriptions || 0}</strong> subs
            </span>
            <span>&middot;</span>
            <span title="Invoices">
              <strong className="text-foreground">{counts?.invoices || 0}</strong> inv
            </span>
          </div>
        );
      },
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
              setSelectedCustomerForEdit(row.original);
              setFormOpen(true);
            }}
            title="Edit customer"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10"
            onClick={() => router.push(`${basePath}/${row.original.id}`)}
            title="View details"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customer accounts, billing profiles, enterprise tax identities, and active subscriptions"
        breadcrumbs={[
          { label: role === "admin" ? "Admin" : "Staff", href: `/${role}` },
          { label: "Customers" },
        ]}
        actions={
          <Button
            onClick={() => {
              setSelectedCustomerForEdit(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Customer
          </Button>
        }
      />

      <div className="px-6 pb-6">
        <DataTable
          columns={columns}
          data={customers}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          searchPlaceholder="Search customers by name, email, or tax ID..."
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`${basePath}/${row.id}`)}
          emptyTitle="No customer profiles found"
          emptyDescription="Create customer profiles to issue quotations, subscriptions, and recurring invoices."
        />
      </div>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customerToEdit={selectedCustomerForEdit}
        onSuccess={loadData}
      />
    </div>
  );
}

