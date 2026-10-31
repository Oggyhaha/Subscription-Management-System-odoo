"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Search,
  Send,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  User,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getEmailLogsAction,
  retryEmailLogAction,
  sendTestEmailAction,
  type EmailLogItem,
} from "@/server/actions/email";

interface InitialMetrics {
  totalAll: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
}

interface InitialPagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

interface EmailLogsClientProps {
  initialLogs: EmailLogItem[];
  initialMetrics: InitialMetrics;
  initialPagination: InitialPagination;
}

export function EmailLogsClient({
  initialLogs,
  initialMetrics,
  initialPagination,
}: EmailLogsClientProps) {
  const [logs, setLogs] = React.useState<EmailLogItem[]>(initialLogs);
  const [metrics, setMetrics] = React.useState<InitialMetrics>(initialMetrics);
  const [pagination, setPagination] = React.useState<InitialPagination>(initialPagination);
  const [loading, setLoading] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  // Detail Modal State
  const [detailItem, setDetailItem] = React.useState<EmailLogItem | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Test Email Modal State
  const [testModalOpen, setTestModalOpen] = React.useState(false);
  const [testRecipient, setTestRecipient] = React.useState("");
  const [testTemplate, setTestTemplate] = React.useState<
    "RESET_PASSWORD" | "INVITATION" | "QUOTATION" | "INVOICE" | "PAYMENT" | "RENEWAL"
  >("INVOICE");
  const [sendingTest, setSendingTest] = React.useState(false);

  const fetchLogs = React.useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      try {
        const res = await getEmailLogsAction({
          status: statusFilter,
          search: searchQuery,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page: pageToLoad,
          pageSize: 20,
        });

        if (res.success && res.data) {
          setLogs(res.data as unknown as EmailLogItem[]);
          if (res.pagination) setPagination(res.pagination);
          if (res.metrics) setMetrics(res.metrics);
        } else {
          toast.error(res.error || "Failed to load email delivery logs");
        }
      } catch (err: unknown) {
        toast.error("Network error fetching email logs");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, searchQuery, startDate, endDate]
  );

  const handleRetry = async (logId: string) => {
    setRetryingId(logId);
    try {
      const res = await retryEmailLogAction(logId);
      if (res.success) {
        toast.success(res.message || "Email re-sent successfully!");
        await fetchLogs(pagination.page);
        if (detailItem && detailItem.id === logId) {
          setDetailOpen(false);
        }
      } else {
        toast.error(res.error || "Failed to retry email delivery");
      }
    } catch {
      toast.error("An error occurred while retrying delivery");
    } finally {
      setRetryingId(null);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient || !testRecipient.includes("@")) {
      toast.error("Please enter a valid recipient email address");
      return;
    }

    setSendingTest(true);
    try {
      const res = await sendTestEmailAction({
        recipient: testRecipient,
        templateType: testTemplate,
      });

      if (res.success) {
        toast.success(res.message || "Test email dispatched successfully!");
        setTestModalOpen(false);
        setTestRecipient("");
        await fetchLogs(1);
      } else {
        toast.error(res.error || "Failed to deliver test email");
      }
    } catch {
      toast.error("Unexpected error sending test email");
    } finally {
      setSendingTest(false);
    }
  };

  const clearFilters = () => {
    setStatusFilter("ALL");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters =
    statusFilter !== "ALL" || searchQuery !== "" || startDate !== "" || endDate !== "";

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Email Delivery Logs"
        description="Monitor outgoing transactional emails, inspect error diagnostics, and retry delivery."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Email Logs", href: "/admin/email-logs" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(pagination.page)}
              disabled={loading}
              className="gap-1.5"
            >
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setTestModalOpen(true)}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              Send Test Email
            </Button>
          </div>
        }
      />

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Dispatched"
          value={metrics.totalAll.toLocaleString()}
          subtitle="All transactional emails"
          icon={Mail}
        />
        <KpiCard
          title="Delivered (Sent)"
          value={metrics.sentCount.toLocaleString()}
          subtitle="Successfully handed to SMTP"
          icon={CheckCircle2}
        />
        <KpiCard
          title="Delivery Failures"
          value={metrics.failedCount.toLocaleString()}
          subtitle="Requires attention or retry"
          icon={AlertTriangle}
        />
        <KpiCard
          title="Pending / Queued"
          value={metrics.pendingCount.toLocaleString()}
          subtitle="In transmission"
          icon={Clock}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipient or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLogs(1)}
                className="pl-8 text-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              aria-label="Filter by delivery status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Statuses</option>
              <option value="SENT">Delivered (Sent)</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>

            {/* Date Range */}
            <div className="flex items-center gap-1.5">
              <Input
                aria-label="Start date filter"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-36 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                aria-label="End date filter"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-36 text-xs"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchLogs(1)}
              disabled={loading}
              className="gap-1 text-xs"
            >
              <Filter className="h-3.5 w-3.5" />
              Apply
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Showing {logs.length} of {pagination.total} records
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        {logs.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No email logs found"
            description={
              hasActiveFilters
                ? "No delivery records match the current filter criteria."
                : "No transactional emails have been recorded yet."
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Reset filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setTestModalOpen(true)}>
                  Send a test email
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Recipient</th>
                  <th scope="col" className="px-4 py-3">Subject</th>
                  <th scope="col" className="px-4 py-3">Related Resource</th>
                  <th scope="col" className="px-4 py-3">Dispatched At</th>
                  <th scope="col" className="px-4 py-3">Error / Diagnostics</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const isFailed = log.status === "FAILED";
                  return (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]" title={log.recipient}>
                            {log.recipient}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[260px] truncate font-medium text-foreground" title={log.subject}>
                          {log.subject}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {log.invoice ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-primary">
                            <FileText className="h-3 w-3" />
                            {log.invoice.invoiceNumber}
                          </span>
                        ) : log.user ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {log.user.name || log.user.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isFailed ? (
                          <span
                            className="inline-block max-w-[220px] truncate font-mono text-xs text-destructive"
                            title={log.errorMessage || "Delivery failed"}
                          >
                            {log.errorMessage || "Delivery failed"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">OK</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setSelectedDetail(log);
                            }}
                            title="View email payload"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {isFailed && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                              disabled={retryingId === log.id}
                              onClick={() => handleRetry(log.id)}
                            >
                              <RotateCw
                                className={`h-3 w-3 ${retryingId === log.id ? "animate-spin" : ""}`}
                              />
                              Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.pageCount} ({pagination.total} total)
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="h-8 gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.pageCount || loading}
                className="h-8 gap-1 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Email Detail Inspection Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                  <Mail className="h-4 w-4 text-primary" />
                  Email Delivery Diagnostic
                </DialogTitle>
                <DialogDescription>
                  Detailed message record and SMTP delivery metadata.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-sm">
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Recipient:</span>
                    <p className="font-mono font-medium text-foreground">{detailItem.recipient}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-0.5">
                      <StatusBadge status={detailItem.status} />
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created At:</span>
                    <p className="font-medium text-foreground">
                      {new Date(detailItem.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delivered At:</span>
                    <p className="font-medium text-foreground">
                      {detailItem.sentAt ? new Date(detailItem.sentAt).toLocaleString() : "Not delivered"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Subject</label>
                  <p className="mt-1 font-medium text-foreground">{detailItem.subject}</p>
                </div>

                {detailItem.status === "FAILED" && detailItem.errorMessage && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Sanitized SMTP Error Output
                    </div>
                    <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-destructive">
                      {detailItem.errorMessage}
                    </pre>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Message Body</label>
                  <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground whitespace-pre-wrap">
                    {detailItem.body}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <div>
                  {detailItem.status === "FAILED" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRetry(detailItem.id)}
                      disabled={retryingId === detailItem.id}
                      className="gap-1.5 text-xs"
                    >
                      <RotateCw className={`h-3.5 w-3.5 ${retryingId === detailItem.id ? "animate-spin" : ""}`} />
                      Retry Delivery Now
                    </Button>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Test Email Modal */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSendTestEmail}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                <Send className="h-4 w-4 text-primary" />
                Send Test Transactional Email
              </DialogTitle>
              <DialogDescription>
                Verify local SMTP sinks (Mailpit/Ethereal) and test template rendering.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Template Type
                </label>
                <select
                  value={testTemplate}
                  onChange={(e) =>
                    setTestTemplate(
                      e.target.value as "RESET_PASSWORD" | "INVITATION" | "QUOTATION" | "INVOICE" | "PAYMENT" | "RENEWAL"
                    )
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="INVOICE">1. Invoice Delivery</option>
                  <option value="PAYMENT">2. Payment Receipt Confirmation</option>
                  <option value="QUOTATION">3. Quotation Delivery</option>
                  <option value="RENEWAL">4. Subscription Renewal Reminder</option>
                  <option value="RESET_PASSWORD">5. Password Reset Request</option>
                  <option value="INVITATION">6. Staff Account Invitation</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Recipient Email
                </label>
                <Input
                  type="email"
                  placeholder="e.g. test@example.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Delivered via configured SMTP server ({process.env.NODE_ENV}).
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTestModalOpen(false)}
                disabled={sendingTest}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={sendingTest}
                className="gap-1.5"
              >
                <Send className={`h-3.5 w-3.5 ${sendingTest ? "animate-pulse" : ""}`} />
                {sendingTest ? "Sending..." : "Dispatch Email"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  function setSelectedDetail(item: EmailLogItem) {
    setDetailItem(item);
    setDetailOpen(true);
  }
}
