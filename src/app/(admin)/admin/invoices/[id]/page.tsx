import { InvoiceService } from "@/server/services/invoice";
import { InvoiceDetailView } from "@/components/invoice/InvoiceDetailView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Invoice ${id} — Admin` };
}

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const invoice = await InvoiceService.getInvoiceById(id);
    return <InvoiceDetailView invoice={invoice} basePath="/admin" />;
  } catch {
    notFound();
  }
}

