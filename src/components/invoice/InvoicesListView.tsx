"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { KpiCard } from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/dates";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Printer, FileText, CheckCircle2, Clock, DollarSign, Filter, Search } from "lucide-react";

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date | string;
  dueDate: Date | string;
  totalAmount: any;
  amountPaid: any;
  amountDue: any;
  cycleKey?: string | null;
  customer: {
    id: string;
    name?: string | null;
    user?: { name: string; email: string } | null;
  };
  subscription?: {
    id: string;
    subscriptionNumber: string;
  } | null;
}

interface InvoicesListViewProps {
  invoices: InvoiceListItem[];
  basePath?: string; // "/admin" or "/staff"
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export function InvoicesListView({
  invoices,
  basePath = "/admin",
  pagination,
}: InvoicesListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = React.useState<string>(searchParams.get("status") || "ALL");
  const [paymentFilter, setPaymentFilter] = React.useState<string>(searchParams.get("paymentState") || "ALL");
  const [searchTerm, setSearchTerm] = React.useState<string>(searchParams.get("search") || "");

  // Update URL params when filters change
  const handleFilterChange = (newStatus: string, newPayment: string, newSearch: string) => {
    const params = new URLSearchParams();
    if (newStatus && newStatus !== "ALL") params.set("status", newStatus);
    if (newPayment && newPayment !== "ALL") params.set("paymentState", newPayment);
    if (newSearch) params.set("search", newSearch);
    router.push(`${basePath}/invoices?${params.toString()}`);
  };

  // Calculate local KPI metrics
  const metrics = React.useMemo(() => {
    let totalBilled = 0;
    let totalDue = 0;
    let paidCount = 0;
    let overdueCount = 0;
    const now = new Date();

    invoices.forEach((inv) => {
      totalBilled += Number(inv.totalAmount) || 0;
      totalDue += Number(inv.amountDue) || 0;
      if (inv.status === "PAID") {
        paidCount++;
      } else if (inv.status !== "CANCELLED" && new Date(inv.dueDate) < now) {
        overdueCount++;
      }
    });

    return { totalBilled, totalDue, paidCount, overdueCount };
  }, [invoices]);

  const columns: ColumnDef<InvoiceListItem>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <Link
          href={`${basePath}/invoices/${row.original.id}`}
          className="font-mono text-xs font-semibold text-ink hover:underline"
        >
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const cust = row.original.customer;
        const name = cust.name || cust.user?.name || "Customer";
        return (
          <div>
            <div className="font-medium text-xs text-ink">{name}</div>
            {cust.user?.email && (
              <div className="text-[11px] text-muted-foreground font-mono">{cust.user.email}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "subscription",
      header: "Subscription",
      cell: ({ row }) => {
        const sub = row.original.subscription;
        if (!sub) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <Link
            href={`${basePath}/subscriptions/${sub.id}`}
            className="font-mono text-xs text-muted-foreground hover:text-ink hover:underline"
          >
            {sub.subscriptionNumber}
          </Link>
        );
      },
    },
    {
      accessorKey: "issueDate",
      header: "Issued",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.original.issueDate)}</span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due Date",
      cell: ({ row }) => {
        const isPastDue =
          row.original.status !== "PAID" &&
          row.original.status !== "CANCELLED" &&
          new Date(row.original.dueDate) < new Date();
        return (
          <span className={`text-xs ${isPastDue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {formatDate(row.original.dueDate)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "totalAmount",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono text-xs font-medium text-ink">
          <MoneyText amount={row.original.totalAmount} />
        </div>
      ),
    },
    {
      accessorKey: "amountDue",
      header: () => <div className="text-right">Balance Due</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono text-xs">
          {Number(row.original.amountDue) > 0 ? (
            <span className="font-semibold text-ink">
              <MoneyText amount={row.original.amountDue} />
            </span>
          ) : (
            <span className="text-muted-foreground">Paid</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link href={`${basePath}/invoices/${row.original.id}/print`} target="_blank">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Print / PDF">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href={`${basePath}/invoices/${row.original.id}`}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View Details">
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Automated billing cycles, payment tracking, and idempotent invoice lifecycle."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Billed"
          value={<MoneyText amount={metrics.totalBilled} />}
          subtitle="Invoices in view"
        />
        <KpiCard
          title="Outstanding Balance"
          value={<MoneyText amount={metrics.totalDue} />}
          subtitle="Unpaid receivables"
        />
        <KpiCard
          title="Paid Invoices"
          value={metrics.paidCount.toString()}
          subtitle="Settled in full"
        />
        <KpiCard
          title="Overdue Invoices"
          value={metrics.overdueCount.toString()}
          subtitle="Past payment terms"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-lg border border-rule">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="w-36">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                handleFilterChange(val, paymentFilter, searchTerm);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment State Filter */}
          <div className="w-36">
            <Select
              value={paymentFilter}
              onValueChange={(val) => {
                setPaymentFilter(val);
                handleFilterChange(statusFilter, val, searchTerm);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Payment State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Payments</SelectItem>
                <SelectItem value="PAID">Paid Only</SelectItem>
                <SelectItem value="UNPAID">Unpaid Only</SelectItem>
                <SelectItem value="OVERDUE">Overdue Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search invoice or customer..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleFilterChange(statusFilter, paymentFilter, searchTerm);
              }
            }}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Invoices TanStack Data Table */}
      <DataTable
        columns={columns}
        data={invoices}
        searchPlaceholder="Filter invoice numbers..."
      />

      {/* Pagination summary */}
      {pagination && pagination.pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <div>
            Showing page {pagination.page} of {pagination.pageCount} ({pagination.total} total invoices)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(pagination.page - 1));
                router.push(`${basePath}/invoices?${params.toString()}`);
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pageCount}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(pagination.page + 1));
                router.push(`${basePath}/invoices?${params.toString()}`);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
