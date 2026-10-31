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
import {
  discountRuleSchema,
  type DiscountRuleInput,
} from "@/schemas/discount";
import { createDiscountAction, updateDiscountAction } from "@/server/actions/discount";

interface ProductOption {
  id: string;
  name: string;
}

interface DiscountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountToEdit?: {
    id: string;
    name: string;
    code: string;
    type: "PERCENTAGE" | "FIXED_AMOUNT";
    scope: "ENTIRE_SUBSCRIPTION" | "SPECIFIC_PRODUCTS";
    value: number;
    minPurchaseAmount?: number | null;
    minQuantity?: number | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    maxUsageCount?: number | null;
    productId?: string | null;
    isActive: boolean;
  } | null;
  onSuccess: () => void;
}

export function DiscountFormDialog({
  open,
  onOpenChange,
  discountToEdit,
  onSuccess,
}: DiscountFormDialogProps) {
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      fetch("/api/products?take=100")
        .then((res) => res.json())
        .then((data) => {
          if (data?.products) {
            setProducts(data.products.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
          }
        })
        .catch(() => {});
    }
  }, [open]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DiscountRuleInput>({
    resolver: zodResolver(discountRuleSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "PERCENTAGE",
      scope: "ENTIRE_SUBSCRIPTION",
      value: 10,
      minPurchaseAmount: null,
      minQuantity: null,
      startDate: null,
      endDate: null,
      maxUsageCount: null,
      productId: null,
      isActive: true,
    },
  });

  const selectedType = watch("type");
  const selectedScope = watch("scope");

  React.useEffect(() => {
    if (discountToEdit) {
      reset({
        name: discountToEdit.name,
        code: discountToEdit.code,
        type: discountToEdit.type,
        scope: discountToEdit.scope,
        value: Number(discountToEdit.value),
        minPurchaseAmount: discountToEdit.minPurchaseAmount ? Number(discountToEdit.minPurchaseAmount) : null,
        minQuantity: discountToEdit.minQuantity ? Number(discountToEdit.minQuantity) : null,
        startDate: discountToEdit.startDate ? new Date(discountToEdit.startDate) : null,
        endDate: discountToEdit.endDate ? new Date(discountToEdit.endDate) : null,
        maxUsageCount: discountToEdit.maxUsageCount ? Number(discountToEdit.maxUsageCount) : null,
        productId: discountToEdit.productId || null,
        isActive: discountToEdit.isActive,
      });
    } else {
      reset({
        name: "",
        code: "",
        type: "PERCENTAGE",
        scope: "ENTIRE_SUBSCRIPTION",
        value: 10,
        minPurchaseAmount: null,
        minQuantity: null,
        startDate: null,
        endDate: null,
        maxUsageCount: null,
        productId: null,
        isActive: true,
      });
    }
  }, [discountToEdit, reset, open]);

  const onSubmit = async (data: DiscountRuleInput) => {
    setSubmitting(true);
    try {
      if (discountToEdit) {
        const result = await updateDiscountAction(discountToEdit.id, data);
        if (!result.success) {
          toast.error(result.error || "Failed to update discount rule");
          return;
        }
        toast.success(result.message || "Discount rule updated successfully");
      } else {
        const result = await createDiscountAction(data);
        if (!result.success) {
          toast.error(result.error || "Failed to create discount rule");
          return;
        }
        toast.success(result.message || "Discount rule created successfully");
      }
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-paper border border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight text-ink">
            {discountToEdit ? "Edit Discount Rule" : "Create New Discount Rule"}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-muted">
            Configure automatic coupons, percentage markdowns, or volume incentives with usage caps.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs font-medium text-ink-muted">
                Discount Code *
              </Label>
              <Input
                id="code"
                placeholder="e.g. SUMMER25"
                {...register("code")}
                className="font-mono uppercase bg-paper-2"
              />
              {errors.code && (
                <p className="text-xs text-rose-500 font-medium">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-ink-muted">
                Rule Name *
              </Label>
              <Input
                id="name"
                placeholder="e.g. Summer Promo 25% Off"
                {...register("name")}
                className="bg-paper-2"
              />
              {errors.name && (
                <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs font-medium text-ink-muted">
                Discount Type *
              </Label>
              <select
                id="type"
                {...register("type")}
                className="w-full h-10 px-3 rounded-md bg-paper-2 border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="value" className="text-xs font-medium text-ink-muted">
                {selectedType === "PERCENTAGE" ? "Percentage Value (0-100) *" : "Fixed Dollar Value ($) *"}
              </Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                placeholder={selectedType === "PERCENTAGE" ? "15" : "50.00"}
                {...register("value")}
                className="bg-paper-2"
              />
              {errors.value && (
                <p className="text-xs text-rose-500 font-medium">{errors.value.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scope" className="text-xs font-medium text-ink-muted">
                Applicable Scope *
              </Label>
              <select
                id="scope"
                {...register("scope")}
                className="w-full h-10 px-3 rounded-md bg-paper-2 border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="ENTIRE_SUBSCRIPTION">Entire Subscription</option>
                <option value="SPECIFIC_PRODUCTS">Specific Product Only</option>
              </select>
            </div>
          </div>

          {selectedScope === "SPECIFIC_PRODUCTS" && (
            <div className="space-y-1.5 p-3 rounded-lg bg-paper-2 border border-border/80">
              <Label htmlFor="productId" className="text-xs font-medium text-ink-muted">
                Target Product *
              </Label>
              <select
                id="productId"
                {...register("productId")}
                className="w-full h-10 px-3 rounded-md bg-paper border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">-- Select Target Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.productId && (
                <p className="text-xs text-rose-500 font-medium">{errors.productId.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="minPurchaseAmount" className="text-xs font-medium text-ink-muted">
                Minimum Purchase Amount ($)
              </Label>
              <Input
                id="minPurchaseAmount"
                type="number"
                step="0.01"
                placeholder="Optional, e.g. 100.00"
                {...register("minPurchaseAmount")}
                className="bg-paper-2"
              />
              {errors.minPurchaseAmount && (
                <p className="text-xs text-rose-500 font-medium">{errors.minPurchaseAmount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minQuantity" className="text-xs font-medium text-ink-muted">
                Minimum Item Quantity
              </Label>
              <Input
                id="minQuantity"
                type="number"
                step="1"
                placeholder="Optional, e.g. 5"
                {...register("minQuantity")}
                className="bg-paper-2"
              />
              {errors.minQuantity && (
                <p className="text-xs text-rose-500 font-medium">{errors.minQuantity.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs font-medium text-ink-muted">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
                className="bg-paper-2 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-xs font-medium text-ink-muted">
                Expiration Date
              </Label>
              <Input
                id="endDate"
                type="date"
                {...register("endDate")}
                className="bg-paper-2 text-sm"
              />
              {errors.endDate && (
                <p className="text-xs text-rose-500 font-medium">{errors.endDate.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxUsageCount" className="text-xs font-medium text-ink-muted">
                Max Usage Count
              </Label>
              <Input
                id="maxUsageCount"
                type="number"
                step="1"
                placeholder="Unlimited if blank"
                {...register("maxUsageCount")}
                className="bg-paper-2"
              />
              {errors.maxUsageCount && (
                <p className="text-xs text-rose-500 font-medium">{errors.maxUsageCount.message}</p>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              {...register("isActive")}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            <Label htmlFor="isActive" className="text-sm font-normal text-ink cursor-pointer">
              Discount rule is active and available for redemption
            </Label>
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
            <Button type="submit" disabled={submitting} className="bg-accent text-white hover:bg-accent/90">
              {submitting ? "Saving..." : discountToEdit ? "Update Discount" : "Create Discount"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

