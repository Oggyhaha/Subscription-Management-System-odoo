import { InvoiceService } from "@/server/services/invoice";
import { InvoicePrint } from "@/components/invoice/InvoicePrint";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Print Invoice ${id}` };
}

export default async function StaffInvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const invoice = await InvoiceService.getInvoiceById(id);
    return <InvoicePrint invoice={invoice} basePath="/staff" />;
  } catch {
    notFound();
  }
}

