import { subscriptionService } from "@/server/services/subscription";
import { SubscriptionsListView } from "@/components/subscriptions/SubscriptionsListView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subscriptions — Admin",
};

export default async function AdminSubscriptionsPage() {
  const result = await subscriptionService.listSubscriptions({ pageSize: 100 });

  const serialized = JSON.parse(JSON.stringify(result.items));
  return <SubscriptionsListView subscriptions={serialized} basePath="/admin" />;
}
