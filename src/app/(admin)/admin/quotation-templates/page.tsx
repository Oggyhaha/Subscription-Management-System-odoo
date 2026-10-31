import { quotationService } from "@/server/services/quotation";
import { db } from "@/server/db";
import { QuotationTemplatesView } from "@/components/quotations/QuotationTemplatesView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quotation Templates — Admin",
};

export default async function AdminQuotationTemplatesPage() {
  const [templates, plans, products, customers] = await Promise.all([
    quotationService.listTemplates(),
    db.plan.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    db.product.findMany({ where: { isActive: true }, select: { id: true, name: true, salesPrice: true } }),
    db.customerProfile.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <QuotationTemplatesView
      templates={JSON.parse(JSON.stringify(templates))}
      plans={JSON.parse(JSON.stringify(plans))}
      products={JSON.parse(JSON.stringify(products))}
      customers={JSON.parse(JSON.stringify(customers))}
      basePath="/admin"
    />
  );
}
