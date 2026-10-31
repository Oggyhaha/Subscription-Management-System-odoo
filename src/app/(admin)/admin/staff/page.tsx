"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaffFormDialog } from "@/components/staff/StaffFormDialog";
import { toggleStaffDeactivatedAction } from "@/server/actions/staff";
import {
  Users,
  UserPlus,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
  FileText,
} from "lucide-react";

interface StaffItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isDeactivated: boolean;
  quotationsCreated: number;
}

export default function StaffPage() {
  const [staffList, setStaffList] = React.useState<StaffItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const [formOpen, setFormOpen] = React.useState(false);
  const [targetStaff, setTargetStaff] = React.useState<StaffItem | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);

  const fetchStaff = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff");
      if (!res.ok) throw new Error("Failed to fetch staff members");
      const data = await res.json();
      setStaffList(data || []);
    } catch {
      toast.error("Could not load staff members");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleToggleDeactivate = async () => {
    if (!targetStaff) return;
    try {
      const result = await toggleStaffDeactivatedAction({
        staffId: targetStaff.id,
        deactivated: !targetStaff.isDeactivated,
      });

      if (result.success) {
        toast.success(result.message);
        fetchStaff();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setConfirmDialogOpen(false);
      setTargetStaff(null);
    }
  };

  const filteredStaff = React.useMemo(() => {
    if (!search.trim()) return staffList;
    const q = search.toLowerCase();
    return staffList.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [staffList, search]);

  const totalStaff = staffList.length;
  const activeStaff = staffList.filter((s) => !s.isDeactivated).length;
  const deactivatedStaff = staffList.filter((s) => s.isDeactivated).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Management"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Staff" },
        ]}
        actions={
          <Button
            onClick={() => setFormOpen(true)}
            className="bg-accent text-white hover:bg-accent/90"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Staff Member
          </Button>
        }
      />

      {/* Security Note Banner */}
      <div className="p-4 rounded-lg bg-paper border border-border flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-accent mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-ink">Administrative Staff Control</p>
          <p className="text-ink-muted text-xs mt-0.5">
            Only System Administrators have permissions to provision, inspect, or deactivate internal staff accounts. Staff accounts cannot provision other staff members.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Staff Users"
          value={totalStaff}
          icon={Users}
          subtitle="Provisioned operators"
        />
        <KpiCard
          title="Active Staff"
          value={activeStaff}
          icon={UserCheck}
          subtitle="Eligible to sign in"
        />
        <KpiCard
          title="Deactivated Staff"
          value={deactivatedStaff}
          icon={UserX}
          subtitle="Access suspended"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-paper"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-paper overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading staff members...</div>
        ) : filteredStaff.length === 0 ? (
          <EmptyState
            title="No staff members found"
            description="Add your first internal team member to draft quotations and manage customer accounts."
            action={
              <Button
                onClick={() => setFormOpen(true)}
                size="sm"
                className="bg-accent text-white hover:bg-accent/90"
              >
                Add Staff Member
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-border bg-paper-2 text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Quotations Drafted</th>
                  <th className="py-3 px-4">Provisioned On</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-paper-2/50 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-ink">
                      <div>{staff.name}</div>
                      <div className="text-xs text-ink-muted">{staff.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-paper-3 border border-border text-ink">
                        STAFF
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-sm font-medium text-ink">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-ink-muted" />
                        <span>{staff.quotationsCreated}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-ink-muted">
                      {new Date(staff.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={staff.isDeactivated ? "INACTIVE" : "ACTIVE"} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant={staff.isDeactivated ? "outline" : "ghost"}
                        size="sm"
                        className={
                          staff.isDeactivated
                            ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            : "text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                        }
                        onClick={() => {
                          setTargetStaff(staff);
                          setConfirmDialogOpen(true);
                        }}
                      >
                        {staff.isDeactivated ? "Reactivate" : "Deactivate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staff Provision Dialog */}
      <StaffFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchStaff}
      />

      {/* Deactivate/Reactivate Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={targetStaff?.isDeactivated ? "Reactivate Staff Account" : "Deactivate Staff Account"}
        description={
          targetStaff?.isDeactivated
            ? `Are you sure you want to restore access for ${targetStaff?.name} (${targetStaff?.email})?`
            : `Are you sure you want to suspend access for ${targetStaff?.name} (${targetStaff?.email})? They will no longer be able to sign in.`
        }
        confirmLabel={targetStaff?.isDeactivated ? "Reactivate" : "Deactivate"}
        variant={targetStaff?.isDeactivated ? "default" : "destructive"}
        onConfirm={handleToggleDeactivate}
      />
    </div>
  );
}
