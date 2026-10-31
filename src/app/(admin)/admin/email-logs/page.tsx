import { getEmailLogsAction, type EmailLogItem } from "@/server/actions/email";
import { EmailLogsClient } from "./EmailLogsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email Delivery Logs — Admin",
  description: "Monitor and manage transactional email delivery logs.",
};

export default async function AdminEmailLogsPage() {
  const result = await getEmailLogsAction({
    page: 1,
    pageSize: 20,
  });

  const initialLogs = (result.data || []) as unknown as EmailLogItem[];
  const initialMetrics = result.metrics || {
    totalAll: 0,
    sentCount: 0,
    failedCount: 0,
    pendingCount: 0,
  };
  const initialPagination = result.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    pageCount: 1,
  };

  return (
    <EmailLogsClient
      initialLogs={initialLogs}
      initialMetrics={initialMetrics}
      initialPagination={initialPagination}
    />
  );
}

