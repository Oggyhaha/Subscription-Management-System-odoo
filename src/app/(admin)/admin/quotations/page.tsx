import { quotationService } from "@/server/services/quotation";
import { QuotationsListView } from "@/components/quotations/QuotationsListView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quotations — Admin",
};

export default async function AdminQuotationsPage() {
  const result = await quotationService.listQuotations({ pageSize: 100 });

  return <QuotationsListView quotations={result.items as any} basePath="/admin" />;
}
