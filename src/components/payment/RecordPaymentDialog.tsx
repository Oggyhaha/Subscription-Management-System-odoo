"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPaymentSchema, type RecordPaymentInput } from "@/schemas/payment";
import { recordPaymentAction } from "@/server/actions/payment";
import { CreditCard, Banknote, Building2, CheckSquare } from "lucide-react";

export interface RecordPaymentInvoice {
  id: string;
  invoiceNumber: string;
  amountDue: number;
  totalAmount?: number;
  customerName?: string;
}

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: RecordPaymentInvoice | null;
  onSuccess: () => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      invoiceId: "",
      amount: 0,
      paymentMethod: "BANK_TRANSFER",
      paymentDate: new Date(),
      referenceNote: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (invoice && open) {
      reset({
        invoiceId: invoice.id,
        amount: Number(invoice.amountDue),
        paymentMethod: "BANK_TRANSFER",
        paymentDate: new Date(),
        referenceNote: "",
        notes: "",
      });
    }
  }, [invoice, open, reset]);

  const onSubmit = async (data: RecordPaymentInput) => {
    if (!invoice) return;

    if (Number(data.amount) > Number(invoice.amountDue)) {
      toast.error(`Payment amount ($${data.amount}) cannot exceed balance due ($${invoice.amountDue.toFixed(2)})`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await recordPaymentAction(data);
      if (!result.success) {
        toast.error(result.error || "Failed to record payment");
        return;
      }

      toast.success(result.message || "Payment recorded successfully");
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-paper border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight text-ink">
            Record Invoice Payment
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-muted">
            Recording payment for invoice <strong className="text-ink">#{invoice.invoiceNumber}</strong>
            {invoice.customerName ? ` (${invoice.customerName})` : ""}.
          </DialogDescription>
        </DialogHeader>

        {/* Balance Overview Box */}
        <div className="p-3.5 rounded-lg bg-paper-2 border border-border flex items-center justify-between text-sm">
          <div>
            <span className="text-xs text-ink-muted block">Remaining Balance Due:</span>
            <span className="text-lg font-bold font-mono text-ink">
              ₹${Number(invoice.amountDue).toFixed(2)}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setValue("amount", Number(invoice.amountDue))}
          >
            Pay Full Balance
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <input type="hidden" {...register("invoiceId")} value={invoice.id} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount" className="text-xs font-medium text-ink-muted">
                Amount Received ($) *
              </Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount")}
                className="font-mono bg-paper-2"
              />
              {errors.amount && (
                <p className="text-xs text-rose-500 font-medium">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-method" className="text-xs font-medium text-ink-muted">
                Payment Method *
              </Label>
              <select
                id="pay-method"
                {...register("paymentMethod")}
                className="w-full h-10 px-3 rounded-md bg-paper-2 border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="BANK_TRANSFER">Bank Transfer / UPI</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="ACH">ACH Direct Debit</option>
                <option value="CASH">Cash</option>
                <option value="CHECK">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-date" className="text-xs font-medium text-ink-muted">
                Payment Date *
              </Label>
              <Input
                id="pay-date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                {...register("paymentDate")}
                className="text-sm bg-paper-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-ref" className="text-xs font-medium text-ink-muted">
                Reference / Transaction #
              </Label>
              <Input
                id="pay-ref"
                placeholder="e.g. CHK-4091 or TXN-882"
                {...register("referenceNote")}
                className="font-mono text-xs bg-paper-2"
              />
              {errors.referenceNote && (
                <p className="text-xs text-rose-500 font-medium">{errors.referenceNote.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-notes" className="text-xs font-medium text-ink-muted">
              Internal Notes (Optional)
            </Label>
            <Input
              id="pay-notes"
              placeholder="e.g. Verified by bank statement reconciliation"
              {...register("notes")}
              className="text-xs bg-paper-2"
            />
          </div>

          <DialogFooter className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-accent text-white hover:bg-accent/90"
            >
              {submitting ? "Processing..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

