import { CustomersView } from "@/components/catalog/CustomersView";

export const metadata = {
  title: "Customers — Brightloop Staff",
};

export default function StaffCustomersPage() {
  return <CustomersView basePath="/staff/customers" role="staff" />;
}

