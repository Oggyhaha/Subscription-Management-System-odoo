import { CustomerDetailView } from "@/components/catalog/CustomerDetailView";

export const metadata = {
  title: "Customer Profile — Brightloop Staff",
};

export default async function StaffCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <CustomerDetailView
      customerId={id}
      basePath="/staff/customers"
      role="staff"
    />
  );
}
