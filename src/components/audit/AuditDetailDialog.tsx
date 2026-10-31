"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldStateParsed: Record<string, unknown> | null;
  newStateParsed: Record<string, unknown> | null;
  metadataParsed: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface AuditDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditLogItem | null;
}

export function AuditDetailDialog({ open, onOpenChange, log }: AuditDetailDialogProps) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-paper border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight text-ink flex items-center justify-between">
            <span>Audit Trail Details</span>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded bg-paper-3 text-ink-muted">
              {log.action}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-muted">
            Immutable system security log ID: <span className="font-mono">{log.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm text-ink">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-paper-2 border border-border/80 text-xs">
            <div>
              <span className="text-ink-muted block">Entity / Target:</span>
              <span className="font-medium text-ink">
                {log.entityType} ({log.entityId})
              </span>
            </div>
            <div>
              <span className="text-ink-muted block">Performed By:</span>
              <span className="font-medium text-ink">
                {log.user ? `${log.user.name} (${log.user.email})` : "System / Anonymous"}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block">Timestamp:</span>
              <span className="font-medium text-ink">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block">IP Address:</span>
              <span className="font-medium font-mono text-ink">
                {log.ipAddress || "Internal System"}
              </span>
            </div>
          </div>

          {/* State Diff / Payload */}
          {log.oldStateParsed && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">Previous State (old_state):</span>
              <pre className="p-3 rounded-md bg-paper-2 border border-border text-xs font-mono overflow-x-auto text-ink">
                {JSON.stringify(log.oldStateParsed, null, 2)}
              </pre>
            </div>
          )}

          {log.newStateParsed && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">Updated State (new_state):</span>
              <pre className="p-3 rounded-md bg-paper-2 border border-border text-xs font-mono overflow-x-auto text-ink">
                {JSON.stringify(log.newStateParsed, null, 2)}
              </pre>
            </div>
          )}

          {log.metadataParsed && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">Additional Context (metadata):</span>
              <pre className="p-3 rounded-md bg-paper-2 border border-border text-xs font-mono overflow-x-auto text-ink">
                {JSON.stringify(log.metadataParsed, null, 2)}
              </pre>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

