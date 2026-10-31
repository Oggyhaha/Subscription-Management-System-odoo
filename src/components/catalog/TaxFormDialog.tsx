"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taxRuleSchema, TaxRuleInput } from "@/schemas/catalog";
import { createTaxRuleAction, updateTaxRuleAction } from "@/server/actions/catalog";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface TaxFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleToEdit?: {
    id: string;
    name: string;
    rate: any;
    country?: string | null;
    state?: string | null;
    isDefault: boolean;
    isActive: boolean;
  } | null;
  onSuccess?: () => void;
}

export function TaxFormDialog({
  open,
  onOpenChange,
  ruleToEdit,
  onSuccess,
}: TaxFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!ruleToEdit;

  const form = useForm<TaxRuleInput>({
    resolver: zodResolver(taxRuleSchema),
    defaultValues: {
      name: "",
      rate: "10.00",
      isInclusive: false,
      country: "India",
      state: "",
      isDefault: false,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (ruleToEdit) {
      // If stored as 0.10, display as 10%
      const rateNum = Number(ruleToEdit.rate);
      const displayRate = rateNum <= 1 ? (rateNum * 100).toFixed(2) : String(rateNum);

      form.reset({
        name: ruleToEdit.name,
        rate: displayRate,
        isInclusive: false,
        country: ruleToEdit.country || "India",
        state: ruleToEdit.state || "",
        isDefault: ruleToEdit.isDefault,
        isActive: ruleToEdit.isActive,
      });
    } else {
      form.reset({
        name: "",
        rate: "10.00",
        isInclusive: false,
        country: "India",
        state: "",
        isDefault: false,
        isActive: true,
      });
    }
  }, [ruleToEdit, form, open]);

  const handleSubmit = async (values: TaxRuleInput) => {
    setIsSubmitting(true);
    try {
      if (isEditing && ruleToEdit) {
        const res = await updateTaxRuleAction(ruleToEdit.id, values);
        if (!res.success) {
          toast.error(res.error || "Failed to update tax rule");
          return;
        }
        toast.success(`Tax rule "${values.name}" updated successfully`);
      } else {
        const res = await createTaxRuleAction(values);
        if (!res.success) {
          toast.error(res.error || "Failed to create tax rule");
          return;
        }
        toast.success(`Tax rule "${values.name}" created successfully`);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Tax Rule" : "Create Tax Rule"}</DialogTitle>
          <DialogDescription>
            Configure tax calculation rates applied during invoice generation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax rule name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. GST Standard (18%)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax rate (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="10.00"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter percentage value (e.g. 10 for 10% or 8.25 for 8.25%)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country code</FormLabel>
                    <FormControl>
                      <Input placeholder="India" value={field.value || ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State / Province (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="MH, DL, GJ, KA..." value={field.value || ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-input text-primary focus:ring-ring"
                  {...form.register("isDefault")}
                />
                <span>Set as system default tax rule</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-input text-primary focus:ring-ring"
                  {...form.register("isInclusive")}
                />
                <span>Tax is inclusive (already included in unit sales price)</span>
              </label>
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
                {isEditing ? "Save Tax Rule" : "Create Tax Rule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

