"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { planSchema, PlanInput, BillingInterval } from "@/schemas/catalog";
import { createPlanAction, updatePlanAction } from "@/server/actions/catalog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planToEdit?: {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    price: any;
    billingInterval: BillingInterval;
    minQuantity: number;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    autoCloseAtEnd: boolean;
    allowEarlyClose: boolean;
    allowPause: boolean;
    allowRenewal: boolean;
    isActive: boolean;
  } | null;
  onSuccess?: () => void;
}

export function PlanFormDialog({
  open,
  onOpenChange,
  planToEdit,
  onSuccess,
}: PlanFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!planToEdit;

  const form = useForm<PlanInput>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      price: "0.00",
      billingInterval: "MONTHLY",
      minQuantity: 1,
      startDate: "",
      endDate: "",
      autoCloseAtEnd: false,
      allowEarlyClose: true,
      allowPause: true,
      allowRenewal: true,
      isActive: true,
      products: [],
    },
  });

  React.useEffect(() => {
    if (planToEdit) {
      form.reset({
        name: planToEdit.name,
        code: planToEdit.code,
        description: planToEdit.description || "",
        price: String(planToEdit.price),
        billingInterval: planToEdit.billingInterval,
        minQuantity: planToEdit.minQuantity ?? 1,
        startDate: planToEdit.startDate
          ? new Date(planToEdit.startDate).toISOString().slice(0, 10)
          : "",
        endDate: planToEdit.endDate
          ? new Date(planToEdit.endDate).toISOString().slice(0, 10)
          : "",
        autoCloseAtEnd: planToEdit.autoCloseAtEnd,
        allowEarlyClose: planToEdit.allowEarlyClose,
        allowPause: planToEdit.allowPause,
        allowRenewal: planToEdit.allowRenewal,
        isActive: planToEdit.isActive,
        products: [],
      });
    } else {
      form.reset({
        name: "",
        code: "",
        description: "",
        price: "0.00",
        billingInterval: "MONTHLY",
        minQuantity: 1,
        startDate: "",
        endDate: "",
        autoCloseAtEnd: false,
        allowEarlyClose: true,
        allowPause: true,
        allowRenewal: true,
        isActive: true,
        products: [],
      });
    }
  }, [planToEdit, form, open]);

  const handleSubmit = async (values: PlanInput) => {
    setIsSubmitting(true);
    try {
      if (isEditing && planToEdit) {
        const res = await updatePlanAction(planToEdit.id, values);
        if (!res.success) {
          toast.error(res.error || "Failed to update plan");
          return;
        }
        toast.success(`Plan "${values.name}" updated successfully`);
      } else {
        const res = await createPlanAction(values);
        if (!res.success) {
          toast.error(res.error || "Failed to create plan");
          return;
        }
        toast.success(`Plan "${values.name}" created successfully`);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Subscription Plan" : "Create Subscription Plan"}</DialogTitle>
          <DialogDescription>
            Configure recurring billing frequency, availability schedule, and lifecycle rules.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Growth Monthly" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="GROWTH-MTH"
                        disabled={isEditing}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurring price ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="199.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing cycle</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min seats / qty</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start availability</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>Leave blank for immediate availability</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End availability</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>Leave blank for indefinite availability</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Lifecycle Permission Rules */}
            <div className="rounded-lg border border-rule bg-paper-3/40 p-3.5 space-y-2">
              <span className="text-xs font-semibold text-foreground block">
                Lifecycle & Subscription Actions
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary focus:ring-ring"
                    {...form.register("allowPause")}
                  />
                  <span>Allow customer pausing</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary focus:ring-ring"
                    {...form.register("allowRenewal")}
                  />
                  <span>Allow subscription renewal</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary focus:ring-ring"
                    {...form.register("allowEarlyClose")}
                  />
                  <span>Allow early termination</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary focus:ring-ring"
                    {...form.register("autoCloseAtEnd")}
                  />
                  <span>Auto-close at expiry</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Plan" : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

