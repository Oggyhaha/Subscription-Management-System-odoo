import { InvoiceService } from "@/server/services/invoice";
import { InvoicesListView } from "@/components/invoice/InvoicesListView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoices — Admin",
};

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    paymentState?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;

  const result = await InvoiceService.listInvoices({
    status: params.status,
    paymentState: params.paymentState,
    search: params.search,
    page,
    pageSize: 50,
  });

  const serialized = JSON.parse(JSON.stringify(result.data));
  return (
    <InvoicesListView
      invoices={serialized}
      pagination={result.pagination}
      basePath="/admin"
    />
  );
}

