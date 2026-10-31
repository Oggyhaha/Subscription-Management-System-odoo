"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { systemSettingsSchema, type SystemSettingsInput } from "@/schemas/settings";
import { updateSettingsAction } from "@/server/actions/settings";
import {
  Building2,
  CreditCard,
  Calculator,
  Save,
  RotateCcw,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<SystemSettingsInput>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      businessName: "",
      supportEmail: "",
      currency: "USD",
      currencySymbol: "₹",
      invoiceDueDaysDefault: 30,
      defaultPaymentTerms: "Net 30",
      roundingPolicy: "Banker's Safe ROUND_HALF_UP (2 Decimal Places)",
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
    },
  });

  const roundingPolicyValue = watch("roundingPolicy");

  const fetchSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      reset({
        businessName: data.businessName,
        supportEmail: data.supportEmail,
        currency: data.currency,
        currencySymbol: data.currencySymbol,
        invoiceDueDaysDefault: data.invoiceDueDaysDefault,
        defaultPaymentTerms: data.defaultPaymentTerms,
        roundingPolicy: data.roundingPolicy || "Banker's Safe ROUND_HALF_UP (2 Decimal Places)",
        addressLine1: data.addressLine1 || "",
        city: data.city || "",
        state: data.state || "",
        postalCode: data.postalCode || "",
        country: data.country || "US",
      });
    } catch {
      toast.error("Could not fetch system settings");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const onSubmit = async (data: SystemSettingsInput) => {
    setSaving(true);
    try {
      const result = await updateSettingsAction(data);
      if (!result.success) {
        toast.error(result.error || "Failed to save settings");
        return;
      }
      toast.success(result.message || "Settings updated successfully");
      reset(data); // Clear dirty state
    } catch {
      toast.error("An unexpected error occurred while saving settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="System Settings"
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Settings" },
          ]}
        />
        <div className="p-12 text-center text-ink-muted">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="System Settings"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Settings" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Section 1: Business Profile */}
        <div className="p-6 rounded-lg border border-border bg-paper space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <Building2 className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink">Business Entity Profile</h2>
              <p className="text-xs text-ink-muted">
                Company identity shown on customer invoices, quotation headers, and email communications.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="businessName" className="text-xs font-medium text-ink-muted">
                Business Name *
              </Label>
              <Input
                id="businessName"
                placeholder="Brightloop Software Inc."
                {...register("businessName")}
                className="bg-paper-2"
              />
              {errors.businessName && (
                <p className="text-xs text-rose-500 font-medium">{errors.businessName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supportEmail" className="text-xs font-medium text-ink-muted">
                Support & Billing Email *
              </Label>
              <Input
                id="supportEmail"
                type="email"
                placeholder="billing@brightloop.com"
                {...register("supportEmail")}
                className="bg-paper-2"
              />
              {errors.supportEmail && (
                <p className="text-xs text-rose-500 font-medium">{errors.supportEmail.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addressLine1" className="text-xs font-medium text-ink-muted">
              Street Address
            </Label>
            <Input
              id="addressLine1"
              placeholder="100 Innovation Way, Suite 400"
              {...register("addressLine1")}
              className="bg-paper-2"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="city" className="text-xs font-medium text-ink-muted">
                City
              </Label>
              <Input id="city" placeholder="San Francisco" {...register("city")} className="bg-paper-2" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-xs font-medium text-ink-muted">
                State / Province
              </Label>
              <Input id="state" placeholder="CA" {...register("state")} className="bg-paper-2" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="postalCode" className="text-xs font-medium text-ink-muted">
                Postal Code
              </Label>
              <Input id="postalCode" placeholder="94105" {...register("postalCode")} className="bg-paper-2" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="country" className="text-xs font-medium text-ink-muted">
                Country
              </Label>
              <Input id="country" placeholder="US" {...register("country")} className="bg-paper-2" />
            </div>
          </div>
        </div>

        {/* Section 2: Invoicing & Payment Terms */}
        <div className="p-6 rounded-lg border border-border bg-paper space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <CreditCard className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink">Invoicing & Financial Defaults</h2>
              <p className="text-xs text-ink-muted">
                System defaults applied to generated recurring invoices and quotation terms.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="currency" className="text-xs font-medium text-ink-muted">
                Currency Code *
              </Label>
              <Input
                id="currency"
                placeholder="USD"
                {...register("currency")}
                className="bg-paper-2 uppercase font-mono"
              />
              {errors.currency && (
                <p className="text-xs text-rose-500 font-medium">{errors.currency.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currencySymbol" className="text-xs font-medium text-ink-muted">
                Currency Symbol *
              </Label>
              <Input
                id="currencySymbol"
                placeholder="₹"
                {...register("currencySymbol")}
                className="bg-paper-2 font-mono"
              />
              {errors.currencySymbol && (
                <p className="text-xs text-rose-500 font-medium">{errors.currencySymbol.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoiceDueDaysDefault" className="text-xs font-medium text-ink-muted">
                Default Due Period (Days) *
              </Label>
              <Input
                id="invoiceDueDaysDefault"
                type="number"
                placeholder="30"
                {...register("invoiceDueDaysDefault")}
                className="bg-paper-2"
              />
              {errors.invoiceDueDaysDefault && (
                <p className="text-xs text-rose-500 font-medium">{errors.invoiceDueDaysDefault.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="defaultPaymentTerms" className="text-xs font-medium text-ink-muted">
                Payment Terms Label *
              </Label>
              <select
                id="defaultPaymentTerms"
                {...register("defaultPaymentTerms")}
                className="w-full h-10 px-3 rounded-md bg-paper-2 border border-border text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="Net 30">Net 30</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 60">Net 60</option>
                <option value="Due on Receipt">Due on Receipt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Financial Rounding Policy Display */}
        <div className="p-6 rounded-lg border border-border bg-paper space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <Calculator className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-ink">Accounting & Rounding Policy</h2>
              <p className="text-xs text-ink-muted">
                Strict financial arithmetic compliance policy enforced across all calculations.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-paper-2 border border-border/80 flex items-start gap-3.5">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-ink">{roundingPolicyValue}</p>
              <p className="text-ink-muted leading-relaxed">
                Brightloop enforces 28-digit precision Decimal arithmetic via Decimal.js and PostgreSQL <code className="font-mono text-ink">DECIMAL(12, 2)</code>. No floating point Math operations are permitted. All taxes, discounts, and line-item allocations use Banker-safe Half-Up rounding, ensuring zero penny slippage across recurring billing cycles.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchSettings}
            disabled={saving || !isDirty}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Discard Changes
          </Button>

          <Button
            type="submit"
            disabled={saving || !isDirty}
            className="bg-accent text-white hover:bg-accent/90 gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

