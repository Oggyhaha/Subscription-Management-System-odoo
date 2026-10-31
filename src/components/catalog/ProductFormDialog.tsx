"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, ProductInput, ProductType } from "@/schemas/catalog";
import { createProductAction, updateProductAction } from "@/server/actions/catalog";
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

export interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productToEdit?: {
    id: string;
    name: string;
    type: ProductType;
    salesPrice: string | number | any;
    costPrice: string | number | any;
    notes?: string | null;
    isActive: boolean;
  } | null;
  onSuccess?: () => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  productToEdit,
  onSuccess,
}: ProductFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!productToEdit;

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      type: "SOFTWARE",
      salesPrice: "0.00",
      costPrice: "0.00",
      notes: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (productToEdit) {
      form.reset({
        name: productToEdit.name,
        type: productToEdit.type,
        salesPrice: String(productToEdit.salesPrice),
        costPrice: String(productToEdit.costPrice),
        notes: productToEdit.notes || "",
        isActive: productToEdit.isActive,
      });
    } else {
      form.reset({
        name: "",
        type: "SOFTWARE",
        salesPrice: "0.00",
        costPrice: "0.00",
        notes: "",
        isActive: true,
      });
    }
  }, [productToEdit, form, open]);

  const handleSubmit = async (values: ProductInput) => {
    setIsSubmitting(true);
    try {
      if (isEditing && productToEdit) {
        const res = await updateProductAction(productToEdit.id, values);
        if (!res.success) {
          toast.error(res.error || "Failed to update product");
          return;
        }
        toast.success(`Product "${values.name}" updated successfully`);
      } else {
        const res = await createProductAction(values);
        if (!res.success) {
          toast.error(res.error || "Failed to create product");
          return;
        }
        toast.success(`Product "${values.name}" created successfully`);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Create Product"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update product catalog details and pricing."
              : "Add a new software license, subscription item, or service to Brightloop."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Enterprise Security Module" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SOFTWARE">Software</SelectItem>
                      <SelectItem value="SERVICE">Service</SelectItem>
                      <SelectItem value="HARDWARE">Hardware</SelectItem>
                      <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="salesPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales price ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="2000.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost price ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="500.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal notes (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Specifications, licensing parameters..."
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isEditing ? "Save Changes" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

