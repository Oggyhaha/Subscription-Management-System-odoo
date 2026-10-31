"use client";

import * as React from "react";
import { ShieldCheck, Users, Receipt, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoLoginAction } from "@/server/actions/auth";

export function DemoPortalBoxes() {
  const [loadingRole, setLoadingRole] = React.useState<"ADMIN" | "STAFF" | "CUSTOMER" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleDemoLogin = async (role: "ADMIN" | "STAFF" | "CUSTOMER") => {
    if (loadingRole) return;
    setLoadingRole(role);
    setError(null);

    try {
      const res = await demoLoginAction(role);
      if (res.success && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        setError(res.error || "Failed to launch demo account");
        setLoadingRole(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error launching demo");
      setLoadingRole(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive text-center">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {/* 1. Admin Portal Box */}
        <div className="flex flex-col justify-between rounded-lg border border-rule bg-card p-5 transition-colors hover:border-primary/40 hover:bg-paper-3/50 shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Administrator
              </div>
              <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-rule">
                admin
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Full plan configuration, taxes, discounts, staff accounts, audit logs, and revenue metrics.
            </p>
            <div className="text-[11px] font-mono text-muted-foreground/80 mb-4 bg-paper-2 p-1.5 rounded border border-rule/60">
              admin@brightloop.com
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => handleDemoLogin("ADMIN")}
            disabled={loadingRole !== null}
            className="w-full gap-1.5 text-xs font-medium"
          >
            {loadingRole === "ADMIN" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Launching Admin...
              </>
            ) : (
              <>
                1-Click Admin Demo
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>

        {/* 2. Staff Operations Box */}
        <div className="flex flex-col justify-between rounded-lg border border-rule bg-card p-5 transition-colors hover:border-primary/40 hover:bg-paper-3/50 shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Users className="h-4 w-4 text-primary" />
                Staff Operations
              </div>
              <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-rule">
                staff
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Daily customer management, quotations, subscription lifecycle actions, and invoice preparation.
            </p>
            <div className="text-[11px] font-mono text-muted-foreground/80 mb-4 bg-paper-2 p-1.5 rounded border border-rule/60">
              sarah.chen@brightloop.com
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => handleDemoLogin("STAFF")}
            disabled={loadingRole !== null}
            className="w-full gap-1.5 text-xs font-medium"
          >
            {loadingRole === "STAFF" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Launching Staff...
              </>
            ) : (
              <>
                1-Click Staff Demo
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>

        {/* 3. Customer Self-Service Box */}
        <div className="flex flex-col justify-between rounded-lg border border-rule bg-card p-5 transition-colors hover:border-primary/40 hover:bg-paper-3/50 shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Receipt className="h-4 w-4 text-primary" />
                Customer Portal
              </div>
              <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-rule">
                customer
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Pre-seeded Acme Corp account with active Starter Monthly plan ($120/mo), invoices, and payments.
            </p>
            <div className="text-[11px] font-mono text-muted-foreground/80 mb-4 bg-paper-2 p-1.5 rounded border border-rule/60">
              alex@acmecorp.com (Acme Corp)
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => handleDemoLogin("CUSTOMER")}
            disabled={loadingRole !== null}
            className="w-full gap-1.5 text-xs font-medium"
          >
            {loadingRole === "CUSTOMER" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Launching Customer...
              </>
            ) : (
              <>
                1-Click Customer Demo
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

