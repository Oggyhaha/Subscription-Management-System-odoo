"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { KpiCard } from "@/components/shared/KpiCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  triggerManualBillingRunAction,
  retrySubscriptionBillingAction,
  flushEmailOutboxAction,
} from "@/server/actions/billing";
import { formatDate } from "@/lib/dates";
import { type BillingRunSummary, type BillingRunResultItem } from "@/server/services/billing";
import {
  PlayCircle,
  Mail,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Layers,
  ArrowRight,
  Eye,
  FileText,
} from "lucide-react";

interface BillingRunsClientProps {
  initialRuns: BillingRunSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export function BillingRunsClient({ initialRuns, pagination }: BillingRunsClientProps) {
  const router = useRouter();
  const [runs, setRuns] = React.useState<BillingRunSummary[]>(initialRuns);
  const [isTriggering, setIsTriggering] = React.useState(false);
  const [isFlushingOutbox, setIsFlushingOutbox] = React.useState(false);
  const [retryingSubId, setRetryingSubId] = React.useState<string | null>(null);
  const [selectedRun, setSelectedRun] = React.useState<BillingRunSummary | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync when initialRuns updates from server revalidation
  React.useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  // Aggregate metrics
  const metrics = React.useMemo(() => {
    let totalInvoicesCreated = 0;
    let totalFailedCycles = 0;
    let totalProcessed = 0;

    runs.forEach((r) => {
      totalInvoicesCreated += r.created || 0;
      totalFailedCycles += r.failed || 0;
      totalProcessed += r.processed || 0;
    });

    const successRate = totalProcessed > 0 ? Math.round(((totalProcessed - totalFailedCycles) / totalProcessed) * 100) : 100;

    return {
      totalRuns: pagination.total || runs.length,
      totalInvoicesCreated,
      totalFailedCycles,
      successRate: `${successRate}%`,
    };
  }, [runs, pagination.total]);

  // Handle Trigger Billing Run
  const handleTriggerBilling = async () => {
    setIsTriggering(true);
    setFeedback(null);
    try {
      const res = await triggerManualBillingRunAction();
      if (!res.success || !res.data) {
        setFeedback({ type: "error", message: res.error || "Billing run failed" });
      } else {
        setFeedback({
          type: "success",
          message: res.message || "Batch billing run completed!",
        });
        setSelectedRun(res.data);
        router.refresh();
      }
    } catch (e: unknown) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Error executing billing run" });
    } finally {
      setIsTriggering(false);
    }
  };

  // Handle Flush Outbox
  const handleFlushOutbox = async () => {
    setIsFlushingOutbox(true);
    setFeedback(null);
    try {
      const res = await flushEmailOutboxAction();
      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to flush outbox" });
      } else {
        setFeedback({
          type: "success",
          message: res.message || "Outbox processed successfully!",
        });
      }
    } catch (e: unknown) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Error flushing outbox" });
    } finally {
      setIsFlushingOutbox(false);
    }
  };

  // Handle Single Subscription Retry
  const handleRetrySubscription = async (subscriptionId: string) => {
    setRetryingSubId(subscriptionId);
    setFeedback(null);
    try {
      const res = await retrySubscriptionBillingAction(subscriptionId);
      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Retry failed" });
      } else {
        setFeedback({
          type: "success",
          message: res.message || "Retry created invoice successfully!",
        });
        // Update item in selectedRun dialog if open
        if (selectedRun && res.data) {
          const updatedResults = selectedRun.results.map((item) =>
            item.subscriptionId === subscriptionId ? res.data! : item
          );
          setSelectedRun({
            ...selectedRun,
            created: selectedRun.created + (res.data.status === "CREATED" ? 1 : 0),
            failed: Math.max(0, selectedRun.failed - (res.data.status === "CREATED" ? 1 : 0)),
            results: updatedResults,
          });
        }
        router.refresh();
      }
    } catch (e: unknown) {
      setFeedback({ type: "error", message: e instanceof Error ? e.message : "Error retrying subscription" });
    } finally {
      setRetryingSubId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Runs"
        description="Automated recurring invoice generation, cycle idempotency, and batch processing history."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleFlushOutbox}
              disabled={isFlushingOutbox}
            >
              <Mail className="h-3.5 w-3.5" />
              {isFlushingOutbox ? "Flushing..." : "Flush Email Outbox"}
            </Button>

            <ConfirmDialog
              title="Execute Due Billing Run"
              description="This will query all ACTIVE subscriptions due for renewal (nextBillingDate <= now), generate invoices in individual transactions, and advance their billing periods. Subscriptions reaching expiry with auto-close enabled will be retired."
              confirmLabel="Run Billing Now"
              onConfirm={handleTriggerBilling}
              isLoading={isTriggering}
              trigger={
                <Button size="sm" className="gap-1.5" disabled={isTriggering}>
                  <PlayCircle className="h-4 w-4" />
                  {isTriggering ? "Running..." : "Trigger Billing Run"}
                </Button>
              }
            />
          </div>
        }
      />

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-md text-xs border ${
            feedback.type === "success"
              ? "bg-status-active text-status-activeFg border-status-activeFg/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Runs"
          value={metrics.totalRuns.toString()}
          subtitle="Cron & manual executions"
        />
        <KpiCard
          title="Invoices Created"
          value={metrics.totalInvoicesCreated.toString()}
          subtitle="Generated via batch runs"
        />
        <KpiCard
          title="Failed Cycles"
          value={metrics.totalFailedCycles.toString()}
          subtitle="Requires attention / retry"
        />
        <KpiCard
          title="Run Success Rate"
          value={metrics.successRate}
          subtitle="Cycle completion ratio"
        />
      </div>

      {/* Runs History Table */}
      <Card className="border-rule">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Billing Runs History</CardTitle>
          <CardDescription className="text-xs">
            Audit history of all scheduled cron and manual billing batch runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-medium text-ink">No billing runs recorded yet.</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click &quot;Trigger Billing Run&quot; above to process due subscriptions or wait for the nightly cron.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-rule hover:bg-transparent">
                  <TableHead className="text-xs">Run ID & Timestamp</TableHead>
                  <TableHead className="text-xs text-center">Processed</TableHead>
                  <TableHead className="text-xs text-center">Created</TableHead>
                  <TableHead className="text-xs text-center">Skipped</TableHead>
                  <TableHead className="text-xs text-center">Failed</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.runId} className="border-rule hover:bg-paper-2">
                    <TableCell className="text-xs">
                      <div className="font-mono font-medium text-ink">{run.runId}</div>
                      <div className="text-[11px] text-muted-foreground">{formatDate(run.startedAt)}</div>
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono">{run.processed}</TableCell>
                    <TableCell className="text-xs text-center font-mono text-status-activeFg font-medium">
                      {run.created}
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono text-muted-foreground">
                      {run.skipped}
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono font-medium">
                      {run.failed > 0 ? (
                        <span className="text-destructive">{run.failed}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {run.failed === 0 ? (
                        <StatusBadge status="completed" />
                      ) : run.created > 0 ? (
                        <StatusBadge status="partial" />
                      ) : (
                        <StatusBadge status="failed" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setSelectedRun(run)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Run Details Modal */}
      {selectedRun && (
        <Dialog open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4" /> Run Details: {selectedRun.runId}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Started {formatDate(selectedRun.startedAt)} • {selectedRun.processed} processed •{" "}
                <span className="text-status-activeFg font-medium">{selectedRun.created} created</span> •{" "}
                <span>{selectedRun.skipped} skipped</span> •{" "}
                <span className={selectedRun.failed > 0 ? "text-destructive font-medium" : ""}>
                  {selectedRun.failed} failed
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-rule">
                    <TableHead className="text-xs">Subscription</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Invoice / Error</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRun.results && selectedRun.results.length > 0 ? (
                    selectedRun.results.map((item, idx) => (
                      <TableRow key={idx} className="border-rule">
                        <TableCell className="text-xs font-mono font-medium">
                          <Link
                            href={`/admin/subscriptions/${item.subscriptionId}`}
                            className="hover:underline text-ink"
                            target="_blank"
                          >
                            {item.subscriptionNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{item.customerName}</TableCell>
                        <TableCell className="text-xs">
                          <StatusBadge
                            status={
                              item.status === "CREATED"
                                ? "active"
                                : item.status === "SKIPPED"
                                ? "paused"
                                : "failed"
                            }
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.invoiceNumber ? (
                            <Link
                              href={`/admin/invoices/${item.invoiceId}`}
                              className="font-mono text-ink hover:underline font-medium"
                              target="_blank"
                            >
                              {item.invoiceNumber} {item.amount && `(${item.amount})`}
                            </Link>
                          ) : (
                            <span className="text-xs text-destructive">{item.error || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {item.status === "FAILED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[11px] gap-1"
                              disabled={retryingSubId === item.subscriptionId}
                              onClick={() => handleRetrySubscription(item.subscriptionId)}
                            >
                              <RotateCcw className={`h-3 w-3 ${retryingSubId === item.subscriptionId ? "animate-spin" : ""}`} />
                              Retry
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                        No per-subscription results recorded for this run.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

