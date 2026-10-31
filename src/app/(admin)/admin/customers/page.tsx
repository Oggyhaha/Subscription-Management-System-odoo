import { CustomersView } from "@/components/catalog/CustomersView";

export const metadata = {
  title: "Customers — Brightloop Admin",
};

export default function AdminCustomersPage() {
  return <CustomersView basePath="/admin/customers" role="admin" />;
}

