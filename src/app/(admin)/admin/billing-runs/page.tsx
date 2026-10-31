import { BillingService } from "@/server/services/billing";
import { BillingRunsClient } from "./BillingRunsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Billing Runs — Admin",
};

export default async function AdminBillingRunsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;

  const result = await BillingService.getBillingRuns({
    page,
    pageSize: 30,
  });

  return (
    <BillingRunsClient
      initialRuns={result.data}
      pagination={result.pagination}
    />
  );
}

