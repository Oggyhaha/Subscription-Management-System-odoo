"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { Button } from "@/components/ui/button";
import { CustomerFormDialog } from "@/components/catalog/CustomerFormDialog";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Receipt,
  Repeat,
  FileSpreadsheet,
  Edit2,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

export interface CustomerDetailViewProps {
  customerId: string;
  basePath: "/admin/customers" | "/staff/customers";
  role: "admin" | "staff";
}

export function CustomerDetailView({
  customerId,
  basePath,
  role,
}: CustomerDetailViewProps) {
  const [customer, setCustomer] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editOpen, setEditOpen] = React.useState(false);

  const loadCustomer = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      if (res.ok) {
        const json = await res.json();
        setCustomer(json.data);
      }
    } catch {
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  React.useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
        Loading customer business profile...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-3">
        <h3 className="text-base font-semibold">Customer not found</h3>
        <p className="text-xs text-muted-foreground">The requested customer record does not exist.</p>
        <Button asChild variant="outline" size="sm">
          <Link href={basePath}>Back to Customers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={`Customer profile &middot; Registered on ${new Date(
          customer.createdAt
        ).toLocaleDateString()}`}
        breadcrumbs={[
          { label: role === "admin" ? "Admin" : "Staff", href: `/${role}` },
          { label: "Customers", href: basePath },
          { label: customer.name },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-2"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Profile
          </Button>
        }
      />

      <div className="px-6 space-y-6 pb-8">
        {/* Profile Card & Stats Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Identity & Contact Card */}
          <Card className="border-rule">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Business Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground block text-[11px]">Email</span>
                  <span className="font-medium text-foreground">{customer.email}</span>
                </div>
              </div>

              {customer.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Phone</span>
                    <span className="font-medium text-foreground">{customer.phone}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-muted-foreground block text-[11px]">Billing Address</span>
                  <span className="font-medium text-foreground block">
                    {customer.addressLine1 || "No street address on file"}
                  </span>
                  {customer.addressLine2 && (
                    <span className="font-medium text-foreground block">
                      {customer.addressLine2}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {[customer.city, customer.state, customer.postalCode, customer.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              </div>

              {customer.taxIdentifier && (
                <div className="pt-2 border-t border-rule flex items-center justify-between">
                  <span className="text-muted-foreground">Tax Identifier</span>
                  <span className="font-mono font-medium">{customer.taxIdentifier}</span>
                </div>
              )}

              <div className="pt-2 border-t border-rule flex items-center justify-between">
                <span className="text-muted-foreground">Web User Account</span>
                {customer.user ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {customer.user.role}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not registered</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Grid */}
          <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
            <Card className="border-rule p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-paper-3 text-primary">
                <Repeat className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Subscriptions</span>
                <span className="text-2xl font-bold font-mono">
                  {customer._count?.subscriptions || 0}
                </span>
              </div>
            </Card>

            <Card className="border-rule p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-paper-3 text-primary">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Invoices</span>
                <span className="text-2xl font-bold font-mono">
                  {customer._count?.invoices || 0}
                </span>
              </div>
            </Card>

            <Card className="border-rule p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-paper-3 text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Quotations</span>
                <span className="text-2xl font-bold font-mono">
                  {customer._count?.quotations || 0}
                </span>
              </div>
            </Card>

            <Card className="border-rule p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-paper-3 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Settled Payments</span>
                <span className="text-2xl font-bold font-mono">
                  {customer._count?.payments || 0}
                </span>
              </div>
            </Card>
          </div>
        </div>

        {/* Subscriptions Table */}
        <Card className="border-rule">
          <CardHeader className="pb-3 border-b border-rule">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Active & Recent Subscriptions</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!customer.subscriptions || customer.subscriptions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No subscription contracts issued for this customer yet.
              </div>
            ) : (
              <div className="divide-y divide-rule text-xs">
                {customer.subscriptions.map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between p-4">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span>{sub.subscriptionNumber || sub.id.slice(0, 8)}</span>
                        <StatusBadge status={sub.status} />
                      </div>
                      <div className="text-muted-foreground">
                        Plan: {sub.plan?.name || "--"} ({sub.billingInterval})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground">
                        Next billing: {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : "--"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices List */}
        <Card className="border-rule">
          <CardHeader className="pb-3 border-b border-rule">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Recent Invoices</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!customer.invoices || customer.invoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No billing statements or invoices generated yet.
              </div>
            ) : (
              <div className="divide-y divide-rule text-xs">
                {customer.invoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-4">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span>{inv.invoiceNumber}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="text-muted-foreground">
                        Issued: {new Date(inv.invoiceDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-foreground">
                        <MoneyText amount={inv.total} />
                      </div>
                      <div className="text-muted-foreground">
                        Due: {new Date(inv.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customerToEdit={customer}
        onSuccess={loadCustomer}
      />
    </div>
  );
}

