"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  pauseCustomerSubscriptionAction,
  resumeCustomerSubscriptionAction,
  renewCustomerSubscriptionAction,
} from "@/server/actions/customer-portal";
import { PauseCircle, PlayCircle, RefreshCw } from "lucide-react";

interface SubscriptionActionButtonsProps {
  subscriptionId: string;
  status: string;
  allowPause: boolean;
  allowRenewal: boolean;
  onSuccess: () => void;
}

export function SubscriptionActionButtons({
  subscriptionId,
  status,
  allowPause,
  allowRenewal,
  onSuccess,
}: SubscriptionActionButtonsProps) {
  const [pauseDialogOpen, setPauseDialogOpen] = React.useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = React.useState(false);
  const [renewDialogOpen, setRenewDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const handlePause = async () => {
    setSubmitting(true);
    try {
      const res = await pauseCustomerSubscriptionAction(subscriptionId);
      if (!res.success) {
        toast.error(res.error || "Failed to pause subscription");
        return;
      }
      toast.success(res.message);
      onSuccess();
    } catch {
      toast.error("Failed to pause subscription");
    } finally {
      setSubmitting(false);
      setPauseDialogOpen(false);
    }
  };

  const handleResume = async () => {
    setSubmitting(true);
    try {
      const res = await resumeCustomerSubscriptionAction(subscriptionId);
      if (!res.success) {
        toast.error(res.error || "Failed to resume subscription");
        return;
      }
      toast.success(res.message);
      onSuccess();
    } catch {
      toast.error("Failed to resume subscription");
    } finally {
      setSubmitting(false);
      setResumeDialogOpen(false);
    }
  };

  const handleRenew = async () => {
    setSubmitting(true);
    try {
      const res = await renewCustomerSubscriptionAction(subscriptionId);
      if (!res.success) {
        toast.error(res.error || "Failed to renew subscription");
        return;
      }
      toast.success(res.message);
      onSuccess();
    } catch {
      toast.error("Failed to renew subscription");
    } finally {
      setSubmitting(false);
      setRenewDialogOpen(false);
    }
  };

  const canPause = status === "ACTIVE" && allowPause;
  const canResume = status === "PAUSED" && allowPause;
  const canRenew = status === "ACTIVE" && allowRenewal;

  if (!canPause && !canResume && !canRenew) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPause && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPauseDialogOpen(true)}
          className="gap-1.5 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
        >
          <PauseCircle className="h-4 w-4" />
          Pause Subscription
        </Button>
      )}

      {canResume && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResumeDialogOpen(true)}
          className="gap-1.5 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
        >
          <PlayCircle className="h-4 w-4" />
          Resume Subscription
        </Button>
      )}

      {canRenew && (
        <Button
          size="sm"
          onClick={() => setRenewDialogOpen(true)}
          className="gap-1.5 text-xs bg-accent text-white hover:bg-accent/90"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Renew Period
        </Button>
      )}

      {/* Confirm Pause */}
      <ConfirmDialog
        open={pauseDialogOpen}
        onOpenChange={setPauseDialogOpen}
        title="Pause Subscription"
        description="Are you sure you want to pause this subscription? Recurring service access and billing will be temporarily halted until resumed."
        confirmLabel="Pause"
        onConfirm={handlePause}
        isLoading={submitting}
      />

      {/* Confirm Resume */}
      <ConfirmDialog
        open={resumeDialogOpen}
        onOpenChange={setResumeDialogOpen}
        title="Resume Subscription"
        description="Are you sure you want to resume this subscription? Active billing and service access will immediately reactivate."
        confirmLabel="Resume"
        onConfirm={handleResume}
        isLoading={submitting}
      />

      {/* Confirm Renew */}
      <ConfirmDialog
        open={renewDialogOpen}
        onOpenChange={setRenewDialogOpen}
        title="Renew Subscription Period"
        description="Are you sure you want to renew this subscription for the next recurring cycle? A new billing period will be appended."
        confirmLabel="Renew"
        onConfirm={handleRenew}
        isLoading={submitting}
      />
    </div>
  );
}

