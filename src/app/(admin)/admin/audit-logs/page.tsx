"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AuditDetailDialog,
  type AuditLogItem,
} from "@/components/audit/AuditDetailDialog";
import {
  ShieldCheck,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";

export default function AuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditLogItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [entityFilter, setEntityFilter] = React.useState("ALL");
  const [actionFilter, setActionFilter] = React.useState("ALL");
  const [actorSearch, setActorSearch] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  // Pagination
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(25);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  // Filter options from backend
  const [entityOptions, setEntityOptions] = React.useState<string[]>([]);
  const [actionOptions, setActionOptions] = React.useState<string[]>([]);

  // Detail Modal
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState<AuditLogItem | null>(null);

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityFilter !== "ALL") params.set("entityType", entityFilter);
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (actorSearch.trim()) params.set("actor", actorSearch.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("skip", ((page - 1) * pageSize).toString());
      params.set("take", pageSize.toString());

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();

      setLogs(data.logs || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);

      if (data.filterOptions) {
        setEntityOptions(data.filterOptions.entityTypes || []);
        setActionOptions(data.filterOptions.actions || []);
      }
    } catch {
      toast.error("Could not fetch audit trail");
    } finally {
      setLoading(false);
    }
  }, [entityFilter, actionFilter, actorSearch, startDate, endDate, page, pageSize]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setEntityFilter("ALL");
    setActionFilter("ALL");
    setActorSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Audit Logs" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Trail
          </Button>
        }
      />

      {/* Info Header */}
      <div className="p-4 rounded-lg bg-paper border border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-accent shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-ink">Read-Only Financial & Security Audit Log</span>
            <p className="text-xs text-ink-muted">
              Every sensitive action, lifecycle change, and administrative mutation is cryptographically timestamped and immutable.
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-ink-muted px-2.5 py-1 rounded bg-paper-2 border border-border">
          Total Recorded: {totalCount}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-lg border border-border bg-paper space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5" />
          Filter Audit Entries
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
            <Input
              placeholder="Actor name/email..."
              value={actorSearch}
              onChange={(e) => {
                setActorSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 text-xs bg-paper-2 h-9"
            />
          </div>

          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2.5 rounded-md bg-paper-2 border border-border text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="ALL">All Entity Types</option>
            {entityOptions.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2.5 rounded-md bg-paper-2 border border-border text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="ALL">All Action Types</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-paper-2 h-9"
            title="Start date"
          />

          <div className="flex gap-2">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-paper-2 h-9 flex-1"
              title="End date"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 text-xs shrink-0"
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-lg border border-border bg-paper overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading audit entries...</div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit entries match your criteria"
            description="Try clearing your filters or widening your date range."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-paper-2/50 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-ink-muted whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-paper-3 border border-border text-ink">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-semibold text-ink">{log.entityType}</span>
                      <span className="text-ink-muted ml-1 font-mono">
                        ({log.entityId.slice(-8)})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {log.user ? (
                        <div>
                          <div className="font-medium text-ink">{log.user.name}</div>
                          <div className="text-ink-muted text-[11px]">{log.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-ink-muted italic">System Automated</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-ink-muted">
                      {log.ipAddress || "Internal"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-accent hover:text-accent/80"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailOpen(true);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        <div className="p-3 border-t border-border bg-paper-2 flex items-center justify-between text-xs text-ink-muted">
          <span>
            Showing page <strong className="text-ink">{page}</strong> of{" "}
            <strong className="text-ink">{totalPages}</strong> ({totalCount} total events)
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2.5 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 px-2.5 text-xs gap-1"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Details Dialog */}
      <AuditDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        log={selectedLog}
      />
    </div>
  );
}
