import { quotationService } from "@/server/services/quotation";
import { QuotationDetailView } from "@/components/quotations/QuotationDetailView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Quotation Detail — Admin` };
}

export default async function AdminQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const quotation = await quotationService.getQuotationById(id);
    return <QuotationDetailView quotation={quotation} basePath="/admin" />;
  } catch {
    notFound();
  }
}
