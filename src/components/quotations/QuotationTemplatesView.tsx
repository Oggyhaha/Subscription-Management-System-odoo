"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createQuotationTemplateAction,
  deleteQuotationTemplateAction,
  generateQuotationFromTemplateAction,
} from "@/server/actions/quotation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, Trash2, FileText, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";

interface TemplateItem {
  id: string;
  name: string;
  validityDays: number;
  isActive: boolean;
  notes: string | null;
  plan: { id: string; name: string } | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: any;
    product: { id: string; name: string };
    variant: { id: string; name: string } | null;
  }>;
}

interface QuotationTemplatesViewProps {
  templates: TemplateItem[];
  plans: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; salesPrice: any }>;
  customers: Array<{ id: string; name: string; email: string }>;
  basePath?: string; // "/admin" or "/staff"
}

export function QuotationTemplatesView({
  templates,
  plans,
  products,
  customers,
  basePath = "/admin",
}: QuotationTemplatesViewProps) {
  const router = useRouter();

  // Create Template Modal
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [templateName, setTemplateName] = React.useState("");
  const [selectedPlanId, setSelectedPlanId] = React.useState("");
  const [validityDays, setValidityDays] = React.useState(30);
  const [notes, setNotes] = React.useState("");
  const [lineItems, setLineItems] = React.useState<Array<{ productId: string; quantity: number; unitPrice: number }>>([
    { productId: products[0]?.id || "", quantity: 1, unitPrice: Number(products[0]?.salesPrice || 0) },
  ]);

  // Generate Quotation Modal
  const [generateModalOpen, setGenerateModalOpen] = React.useState(false);
  const [activeTemplate, setActiveTemplate] = React.useState<TemplateItem | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");
  const [customDays, setCustomDays] = React.useState(30);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const addLineItem = () => {
    if (products.length > 0) {
      setLineItems([
        ...lineItems,
        { productId: products[0].id, quantity: 1, unitPrice: Number(products[0].salesPrice || 0) },
      ]);
    }
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleCreateTemplate = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createQuotationTemplateAction({
        name: templateName,
        planId: selectedPlanId || null,
        validityDays,
        notes,
        isActive: true,
        items: lineItems.map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discountPercent: 0,
        })),
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to create template");
      } else {
        setIsCreateOpen(false);
        router.refresh();
      }
    } catch (e: any) {
      setErrorMsg(e.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateQuote = async () => {
    if (!activeTemplate || !selectedCustomerId) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await generateQuotationFromTemplateAction({
        templateId: activeTemplate.id,
        customerId: selectedCustomerId,
        customValidityDays: customDays,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to generate quotation");
      } else {
        setGenerateModalOpen(false);
        router.push(`${basePath}/quotations/${(res.data as any).id}`);
        router.refresh();
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to generate quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<TemplateItem>[] = [
    {
      accessorKey: "name",
      header: "Template Name",
      cell: ({ row }) => (
        <div className="font-medium text-foreground">
          {row.original.name}
          {row.original.notes && (
            <div className="text-xs text-muted-foreground truncate max-w-xs">{row.original.notes}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "plan.name",
      header: "Associated Plan",
      cell: ({ row }) => row.original.plan?.name || "—",
    },
    {
      accessorKey: "validityDays",
      header: "Validity",
      cell: ({ row }) => `${row.original.validityDays} Days`,
    },
    {
      id: "linesCount",
      header: "Line Items",
      cell: ({ row }) => (
        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
          {row.original.items?.length || 0} line{(row.original.items?.length || 0) !== 1 ? "s" : ""}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.isActive ? "active" : "closed"} />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                setActiveTemplate(item);
                setSelectedCustomerId(customers[0]?.id || "");
                setCustomDays(item.validityDays || 30);
                setGenerateModalOpen(true);
              }}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Generate Quote
            </Button>
            <ConfirmDialog
              title="Delete Quotation Template"
              description={`Are you sure you want to delete "${item.name}"? This action cannot be undone.`}
              variant="destructive"
              confirmLabel="Delete"
              onConfirm={async () => {
                await deleteQuotationTemplateAction(item.id);
                router.refresh();
              }}
              trigger={
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Templates"
        description="Predefined offers with preset plan, products, and terms for instantaneous quote generation."
        actions={
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        }
      />

      <DataTable columns={columns} data={templates} searchPlaceholder="Search templates..." />

      {/* CREATE TEMPLATE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Quotation Template</DialogTitle>
            <DialogDescription>
              Define standard product lines and terms to reuse across sales reps.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g. Enterprise Annual Package"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Default Plan *</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Validity (Days) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value, 10) || 30)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Internal Notes / Terms</Label>
              <Input
                placeholder="Standard payment terms, SLA notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* LINE ITEMS */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Product Lines</Label>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addLineItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add Product
                </Button>
              </div>

              {lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={item.productId}
                      onValueChange={(val) => {
                        const prod = products.find((p) => p.id === val);
                        const copy = [...lineItems];
                        copy[idx] = {
                          ...copy[idx],
                          productId: val,
                          unitPrice: Number(prod?.salesPrice || 0),
                        };
                        setLineItems(copy);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 text-xs"
                      value={item.quantity}
                      onChange={(e) => {
                        const copy = [...lineItems];
                        copy[idx].quantity = parseInt(e.target.value, 10) || 1;
                        setLineItems(copy);
                      }}
                    />
                  </div>

                  <div className="w-24">
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-xs"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const copy = [...lineItems];
                        copy[idx].unitPrice = parseFloat(e.target.value) || 0;
                        setLineItems(copy);
                      }}
                    />
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLineItem(idx)}
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={isSubmitting || !templateName || !selectedPlanId}>
              {isSubmitting ? "Creating..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GENERATE QUOTE FROM TEMPLATE DIALOG */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Quotation from Template</DialogTitle>
            <DialogDescription>
              Using &quot;{activeTemplate?.name}&quot; to prepare an instant offer for a customer.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 text-xs rounded bg-destructive/10 text-destructive border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <Label>Target Customer *</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Quotation Validity (Days)</Label>
              <Input
                type="number"
                min={1}
                value={customDays}
                onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 30)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateQuote} disabled={isSubmitting || !selectedCustomerId}>
              {isSubmitting ? "Generating..." : "Generate Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

