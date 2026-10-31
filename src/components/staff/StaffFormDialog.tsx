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
import { createStaffSchema, type CreateStaffInput } from "@/schemas/auth";
import { createStaffAction } from "@/server/actions/staff";

interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function StaffFormDialog({ open, onOpenChange, onSuccess }: StaffFormDialogProps) {
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: "",
        email: "",
        password: "",
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: CreateStaffInput) => {
    setSubmitting(true);
    try {
      const result = await createStaffAction({
        name: data.name,
        email: data.email,
        password: data.password || undefined,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create staff account");
        return;
      }

      toast.success(result.message || "Staff member created successfully");
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-paper border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight text-ink">
            Provision Staff Account
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-muted">
            Create an internal staff user who can draft quotations and service customer accounts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="staff-name" className="text-xs font-medium text-ink-muted">
              Full Name *
            </Label>
            <Input
              id="staff-name"
              placeholder="e.g. Sarah Jenkins"
              {...register("name")}
              className="bg-paper-2"
            />
            {errors.name && (
              <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-email" className="text-xs font-medium text-ink-muted">
              Company Email *
            </Label>
            <Input
              id="staff-email"
              type="email"
              placeholder="sarah@brightloop.com"
              {...register("email")}
              className="bg-paper-2"
            />
            {errors.email && (
              <p className="text-xs text-rose-500 font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-password" className="text-xs font-medium text-ink-muted">
              Initial Password (Optional)
            </Label>
            <Input
              id="staff-password"
              type="password"
              placeholder="Leave blank to auto-generate temporary password"
              {...register("password")}
              className="bg-paper-2"
            />
            <p className="text-[11px] text-ink-muted">
              If left blank, a secure temporary password will be generated and emailed with invitation instructions.
            </p>
            {errors.password && (
              <p className="text-xs text-rose-500 font-medium">{errors.password.message}</p>
            )}
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
              {submitting ? "Provisioning..." : "Create Staff Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

