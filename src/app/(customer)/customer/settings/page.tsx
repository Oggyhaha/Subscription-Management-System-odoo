"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  customerProfileUpdateSchema,
  changePasswordSchema,
  type CustomerProfileUpdateInput,
  type ChangePasswordInput,
} from "@/schemas/portal";
import {
  getCustomerProfileAction,
  updateCustomerProfileAction,
  changeCustomerPasswordAction,
} from "@/server/actions/customer-portal";
import { User, MapPin, KeyRound, Save, ShieldCheck } from "lucide-react";

export default function CustomerSettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState("");

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors, isDirty: isProfileDirty },
  } = useForm<CustomerProfileUpdateInput>({
    resolver: zodResolver(customerProfileUpdateSchema),
    defaultValues: {
      name: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
      taxIdentifier: "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const fetchProfile = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomerProfileAction();
      if (!res.success) throw new Error(res.error || "Failed to load profile");
      const d = res.data as any;
      setUserEmail(d?.email || d?.user?.email || "");
      resetProfile({
        name: d.name || "",
        phone: d.phone || "",
        addressLine1: d.addressLine1 || "",
        addressLine2: d.addressLine2 || "",
        city: d.city || "",
        state: d.state || "",
        postalCode: d.postalCode || "",
        country: d.country || "US",
        taxIdentifier: d.taxIdentifier || "",
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error fetching profile");
    } finally {
      setLoading(false);
    }
  }, [resetProfile]);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onProfileSubmit = async (data: CustomerProfileUpdateInput) => {
    setProfileSaving(true);
    try {
      const res = await updateCustomerProfileAction(data);
      if (!res.success) {
        toast.error(res.error || "Failed to update profile");
        return;
      }
      toast.success(res.message);
      resetProfile(data);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setProfileSaving(false);
    }
  };

  const onPasswordSubmit = async (data: ChangePasswordInput) => {
    setPasswordSaving(true);
    try {
      const res = await changeCustomerPasswordAction(data);
      if (!res.success) {
        toast.error(res.error || "Failed to change password");
        return;
      }
      toast.success(res.message);
      resetPassword();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Account Settings" />
        <div className="p-12 text-center text-ink-muted">Loading account preferences...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="Account & Billing Profile"
        breadcrumbs={[
          { label: "Portal", href: "/customer" },
          { label: "Settings" },
        ]}
      />

      {/* Profile & Billing Address Form */}
      <form
        onSubmit={handleProfileSubmit(onProfileSubmit)}
        className="p-6 rounded-lg border border-border bg-paper space-y-6"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <User className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-base font-semibold text-ink">Customer Contact & Billing Address</h2>
            <p className="text-xs text-ink-muted">
              These details will automatically reflect on your official invoices and tax receipts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="prof-name" className="text-xs font-medium text-ink-muted">
              Full Legal / Business Name *
            </Label>
            <Input id="prof-name" {...registerProfile("name")} className="bg-paper-2" />
            {profileErrors.name && (
              <p className="text-xs text-rose-500 font-medium">{profileErrors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prof-email" className="text-xs font-medium text-ink-muted">
              Account Email (Read-Only)
            </Label>
            <Input id="prof-email" value={userEmail} disabled className="bg-paper-3 text-ink-muted" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prof-phone" className="text-xs font-medium text-ink-muted">
              Phone Number
            </Label>
            <Input id="prof-phone" placeholder="+1 (555) 000-0000" {...registerProfile("phone")} className="bg-paper-2" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prof-tax" className="text-xs font-medium text-ink-muted">
              Tax ID / VAT Number
            </Label>
            <Input id="prof-tax" placeholder="e.g. US-123456789" {...registerProfile("taxIdentifier")} className="bg-paper-2 font-mono" />
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="prof-addr1" className="text-xs font-medium text-ink-muted">
            Billing Address Line 1
          </Label>
          <Input id="prof-addr1" placeholder="123 Market St, Suite 100" {...registerProfile("addressLine1")} className="bg-paper-2" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prof-addr2" className="text-xs font-medium text-ink-muted">
            Billing Address Line 2 (Optional)
          </Label>
          <Input id="prof-addr2" placeholder="Floor 4" {...registerProfile("addressLine2")} className="bg-paper-2" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="prof-city" className="text-xs font-medium text-ink-muted">City</Label>
            <Input id="prof-city" placeholder="San Francisco" {...registerProfile("city")} className="bg-paper-2" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-state" className="text-xs font-medium text-ink-muted">State / Province</Label>
            <Input id="prof-state" placeholder="CA" {...registerProfile("state")} className="bg-paper-2" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-zip" className="text-xs font-medium text-ink-muted">Postal Code</Label>
            <Input id="prof-zip" placeholder="94105" {...registerProfile("postalCode")} className="bg-paper-2" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-country" className="text-xs font-medium text-ink-muted">Country</Label>
            <Input id="prof-country" placeholder="US" {...registerProfile("country")} className="bg-paper-2" />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={profileSaving || !isProfileDirty}
            className="bg-accent text-white hover:bg-accent/90 gap-2 text-xs"
          >
            <Save className="h-4 w-4" />
            {profileSaving ? "Saving..." : "Save Profile Details"}
          </Button>
        </div>
      </form>

      {/* Change Password Form */}
      <form
        onSubmit={handlePasswordSubmit(onPasswordSubmit)}
        className="p-6 rounded-lg border border-border bg-paper space-y-5"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <KeyRound className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-base font-semibold text-ink">Change Account Password</h2>
            <p className="text-xs text-ink-muted">
              Passwords must be more than 8 characters, with uppercase, lowercase, and special character.
            </p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="pass-curr" className="text-xs font-medium text-ink-muted">
              Current Password *
            </Label>
            <Input
              id="pass-curr"
              type="password"
              {...registerPassword("currentPassword")}
              className="bg-paper-2"
            />
            {passwordErrors.currentPassword && (
              <p className="text-xs text-rose-500 font-medium">{passwordErrors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pass-new" className="text-xs font-medium text-ink-muted">
              New Password *
            </Label>
            <Input
              id="pass-new"
              type="password"
              {...registerPassword("newPassword")}
              className="bg-paper-2"
            />
            {passwordErrors.newPassword && (
              <p className="text-xs text-rose-500 font-medium">{passwordErrors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pass-conf" className="text-xs font-medium text-ink-muted">
              Confirm New Password *
            </Label>
            <Input
              id="pass-conf"
              type="password"
              {...registerPassword("confirmPassword")}
              className="bg-paper-2"
            />
            {passwordErrors.confirmPassword && (
              <p className="text-xs text-rose-500 font-medium">{passwordErrors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={passwordSaving}
            className="bg-accent text-white hover:bg-accent/90 gap-2 text-xs"
          >
            <KeyRound className="h-4 w-4" />
            {passwordSaving ? "Updating Password..." : "Update Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

