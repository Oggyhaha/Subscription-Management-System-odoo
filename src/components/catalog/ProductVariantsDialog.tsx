"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productVariantSchema, ProductVariantInput } from "@/schemas/catalog";
import { createVariantAction, toggleVariantArchiveAction } from "@/server/actions/catalog";
import { ProductService } from "@/server/services/product";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/form";
import { MoneyText } from "@/components/shared/MoneyText";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { Plus, Loader2, Archive, Check } from "lucide-react";

export interface ProductVariantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    salesPrice: string | number | any;
    variants?: Array<{
      id: string;
      name: string;
      sku?: string | null;
      priceModifier: string | number | any;
      attributeName: string;
      attributeValue: string;
      isActive: boolean;
    }>;
  } | null;
  onVariantsUpdated?: () => void;
}

export function ProductVariantsDialog({
  open,
  onOpenChange,
  product,
  onVariantsUpdated,
}: ProductVariantsDialogProps) {
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ProductVariantInput>({
    resolver: zodResolver(productVariantSchema),
    defaultValues: {
      productId: product?.id || "",
      name: "",
      sku: "",
      priceModifier: "0.00",
      attributeName: "Edition",
      attributeValue: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (product) {
      form.setValue("productId", product.id);
    }
  }, [product, form]);

  if (!product) return null;

  const handleCreateVariant = async (values: ProductVariantInput) => {
    setIsSubmitting(true);
    try {
      const res = await createVariantAction(values);
      if (!res.success) {
        toast.error(res.error || "Failed to create variant");
        return;
      }

      toast.success(`Variant "${values.name}" added`);
      form.reset({
        productId: product.id,
        name: "",
        sku: "",
        priceModifier: "0.00",
        attributeName: "Edition",
        attributeValue: "",
        isActive: true,
      });
      setShowAddForm(false);
      onVariantsUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchive = async (variantId: string, currentActive: boolean) => {
    try {
      const res = await toggleVariantArchiveAction(variantId, !currentActive);
      if (!res.success) {
        toast.error(res.error || "Failed to toggle status");
        return;
      }
      toast.success(currentActive ? "Variant archived" : "Variant reactivated");
      onVariantsUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-4">
            <span>Product Variants: {product.name}</span>
            <Button
              size="sm"
              variant={showAddForm ? "outline" : "default"}
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {showAddForm ? "Cancel" : "Add Variant"}
            </Button>
          </DialogTitle>
          <DialogDescription>
            Configure variant price adjustments over base price (Base:{" "}
            <MoneyText amount={product.salesPrice} />)
          </DialogDescription>
        </DialogHeader>

        {showAddForm && (
          <div className="rounded-lg border border-rule bg-paper-3/40 p-4 mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              New Variant Definition
            </h4>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateVariant)}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Variant name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Enterprise Tier (Odoo 17)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="SKU-ENT-17"
                            value={field.value || ""}
                            onChange={field.onChange}
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
                    name="attributeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attribute</FormLabel>
                        <FormControl>
                          <Input placeholder="Edition" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="attributeValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value</FormLabel>
                        <FormControl>
                          <Input placeholder="Enterprise" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priceModifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price adjustment ($)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="+560.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save Variant
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {/* Existing Variants List */}
        <div className="space-y-2 mt-2">
          {!product.variants || product.variants.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-rule rounded-md">
              No variants configured. Base product is sold directly at{" "}
              <MoneyText amount={product.salesPrice} />.
            </div>
          ) : (
            <div className="divide-y divide-rule rounded-md border border-rule overflow-hidden bg-card">
              {product.variants.map((v) => {
                const effective = ProductService.calculateEffectivePrice(
                  product.salesPrice,
                  v.priceModifier
                );

                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3.5 text-xs hover:bg-paper-3/40 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {v.name}
                        </span>
                        <StatusBadge status={v.isActive ? "active" : "cancelled"} />
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-[11px]">
                          {v.attributeName}: {v.attributeValue}
                        </span>
                        {v.sku && <span>SKU: {v.sku}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono text-xs text-muted-foreground">
                          Adjustment:{" "}
                          <MoneyText
                            amount={v.priceModifier}
                            showPositiveSign
                            className="text-xs"
                          />
                        </div>
                        <div className="font-mono font-semibold text-foreground">
                          Effective: <MoneyText amount={effective} />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleToggleArchive(v.id, v.isActive)}
                        title={v.isActive ? "Archive variant" : "Reactivate variant"}
                      >
                        {v.isActive ? (
                          <Archive className="h-4 w-4" />
                        ) : (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

