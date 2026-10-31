import { InvoiceService } from "@/server/services/invoice";
import { InvoiceDetailView } from "@/components/invoice/InvoiceDetailView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Invoice ${id} — Staff` };
}

export default async function StaffInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const invoice = await InvoiceService.getInvoiceById(id);
    const serialized = JSON.parse(JSON.stringify(invoice));
    return <InvoiceDetailView invoice={serialized} basePath="/staff" />;
  } catch {
    notFound();
  }
}
