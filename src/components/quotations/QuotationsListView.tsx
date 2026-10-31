"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { acceptQuotationAction, sendQuotationAction } from "@/server/actions/quotation";
import { formatDate } from "@/lib/dates";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Send, Eye, FileText, ArrowRight } from "lucide-react";

interface QuotationItem {
  id: string;
  quotationNumber: string;
  status: string;
  issuedDate: Date | string;
  validUntil: Date | string;
  totalAmount: any;
  customer: { id: string; name: string; email: string };
  plan: { id: string; name: string };
  subscription: { id: string; subscriptionNumber: string; status: string } | null;
}

interface QuotationsListViewProps {
  quotations: QuotationItem[];
  basePath?: string; // "/admin" or "/staff"
}

export function QuotationsListView({ quotations, basePath = "/admin" }: QuotationsListViewProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const filteredData = React.useMemo(() => {
    if (statusFilter === "ALL") return quotations;
    return quotations.filter((q) => q.status === statusFilter);
  }, [quotations, statusFilter]);

  const handleAccept = async (id: string) => {
    try {
      const res = await acceptQuotationAction(id);
      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to accept quotation" });
      } else {
        setFeedback({ type: "success", message: res.message || "Quotation accepted into subscription!" });
        router.refresh();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to accept quotation" });
    }
  };

  const handleSend = async (id: string) => {
    try {
      const res = await sendQuotationAction({ quotationId: id });
      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to send email" });
      } else {
        setFeedback({ type: "success", message: "Quotation email dispatched to customer successfully." });
        router.refresh();
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to send email" });
    }
  };

  const columns: ColumnDef<QuotationItem>[] = [
    {
      accessorKey: "quotationNumber",
      header: "Quotation #",
      cell: ({ row }) => (
        <Link
          href={`${basePath}/quotations/${row.original.id}`}
          className="font-mono text-sm font-medium text-primary hover:underline"
        >
          {row.original.quotationNumber}
        </Link>
      ),
    },
    {
      accessorKey: "customer.name",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-foreground">{row.original.customer.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.customer.email}</div>
        </div>
      ),
    },
    {
      accessorKey: "plan.name",
      header: "Plan",
      cell: ({ row }) => row.original.plan.name,
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-semibold text-foreground">
          <MoneyText amount={row.original.totalAmount} />
        </span>
      ),
    },
    {
      accessorKey: "validUntil",
      header: "Valid Until",
      cell: ({ row }) => formatDate(row.original.validUntil),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original;
        const isConvertible = item.status === "DRAFT" || item.status === "SENT";

        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              asChild
              title="View Details"
            >
              <Link href={`${basePath}/quotations/${item.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>

            {isConvertible && (
              <>
                <ConfirmDialog
                  title="Accept Quotation"
                  description={`Accept quotation #${item.quotationNumber} and create an active Subscription for ${item.customer.name}?`}
                  confirmLabel="Accept & Create Subscription"
                  onConfirm={() => handleAccept(item.id)}
                  trigger={
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs text-emerald-600 border-emerald-600/30 hover:bg-emerald-50">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-muted-foreground"
                  onClick={() => handleSend(item.id)}
                  title="Send via Email"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </Button>
              </>
            )}

            {item.subscription && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs font-mono text-primary" asChild>
                <Link href={`${basePath}/subscriptions/${item.subscription.id}`}>
                  {item.subscription.subscriptionNumber}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Prepare offers for potential subscribers, manage approval lifecycle, and convert into recurring contracts."
        actions={
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Button asChild className="gap-2">
              <Link href={`${basePath}/quotation-templates`}>
                <FileText className="h-4 w-4" />
                From Template
              </Link>
            </Button>
          </div>
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded text-xs border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <DataTable columns={columns} data={filteredData} searchPlaceholder="Search quotations..." />
    </div>
  );
}

