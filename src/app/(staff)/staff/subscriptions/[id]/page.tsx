import { subscriptionService } from "@/server/services/subscription";
import { SubscriptionDetailView } from "@/components/subscriptions/SubscriptionDetailView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Subscription Detail — Staff` };
}

export default async function StaffSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const subscription = await subscriptionService.getSubscriptionById(id);
    return <SubscriptionDetailView subscription={subscription} basePath="/staff" />;
  } catch {
    notFound();
  }
}
