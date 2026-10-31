"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { CustomerInvoicePrintView } from "@/components/portal/CustomerInvoicePrintView";
import { getCustomerInvoiceDetailsAction } from "@/server/actions/customer-portal";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function CustomerInvoiceDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [invoice, setInvoice] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCustomerInvoiceDetailsAction(id)
      .then((res) => {
        if (!res.success) {
          throw new Error(res.error || "Invoice not found");
        }
        setInvoice(res.data);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Error loading invoice");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoice Details" />
        <div className="p-12 text-center text-ink-muted">Loading invoice statement...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoice Details" />
        <div className="p-12 text-center text-ink-muted">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-2 opacity-80" />
          <h2 className="text-base font-semibold text-ink">Invoice Not Found</h2>
          <p className="text-xs text-ink-muted mt-1">
            This invoice does not exist or does not belong to your account.
          </p>
          <div className="pt-4">
            <Link href="/customer/invoices">
              <Button variant="outline" size="sm">Back to My Invoices</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CustomerInvoicePrintView invoice={invoice} />;
}

