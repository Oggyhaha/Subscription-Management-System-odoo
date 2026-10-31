import { CustomerDetailView } from "@/components/catalog/CustomerDetailView";

export const metadata = {
  title: "Customer Profile — Brightloop Admin",
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <CustomerDetailView
      customerId={id}
      basePath="/admin/customers"
      role="admin"
    />
  );
}
