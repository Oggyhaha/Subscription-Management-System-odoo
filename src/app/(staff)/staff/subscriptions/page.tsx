import { subscriptionService } from "@/server/services/subscription";
import { SubscriptionsListView } from "@/components/subscriptions/SubscriptionsListView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subscriptions — Staff",
};

export default async function StaffSubscriptionsPage() {
  const result = await subscriptionService.listSubscriptions({ pageSize: 100 });

  const serialized = JSON.parse(JSON.stringify(result.items));
  return <SubscriptionsListView subscriptions={serialized} basePath="/staff" />;
}
