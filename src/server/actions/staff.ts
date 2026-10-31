"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireRole } from "@/server/auth/guards";
import { createStaffAccountAction } from "@/server/actions/auth";
import { settingsService } from "@/server/services/settings";
import { writeAuditLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { createStaffSchema, type CreateStaffInput } from "@/schemas/auth";
import type { ActionResult } from "@/server/actions/auth";

export interface StaffListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  isDeactivated: boolean;
  quotationsCreated: number;
}

/**
 * Creates a new staff member account.
 * STRICT ENFORCEMENT: Calls requireRole("ADMIN"). Staff members cannot create staff.
 */
export async function createStaffAction(input: CreateStaffInput): Promise<ActionResult> {
  // Explicitly guard: only ADMIN can create staff. If caller is STAFF, this throws 403 Forbidden.
  await requireRole("ADMIN");
  return createStaffAccountAction(input);
}

/**
 * Lists all internal staff accounts (ADMIN only)
 */
export async function listStaffAction(): Promise<ActionResult<StaffListItem[]>> {
  try {
    await requireRole("ADMIN");

    const staffUsers = await db.user.findMany({
      where: { role: "STAFF" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            createdQuotations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const settings = await settingsService.getSettings();
    const deactivatedSet = new Set(settings.deactivatedStaffIds);

    const items: StaffListItem[] = staffUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      isDeactivated: deactivatedSet.has(user.id),
      quotationsCreated: user._count.createdQuotations,
    }));

    return {
      success: true,
      data: items,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load staff list";
    return { success: false, error: message };
  }
}

/**
 * Toggles deactivation status of a staff member (ADMIN only)
 */
export async function toggleStaffDeactivatedAction(params: {
  staffId: string;
  deactivated: boolean;
}): Promise<ActionResult> {
  try {
    const admin = await requireRole("ADMIN");

    const targetUser = await db.user.findUnique({
      where: { id: params.staffId },
    });

    if (!targetUser) {
      throw AppError.notFound("Staff user not found");
    }

    if (targetUser.role !== "STAFF") {
      throw AppError.badRequest("Only staff member accounts can be deactivated using this action");
    }

    await settingsService.setStaffDeactivated(params.staffId, params.deactivated);

    await writeAuditLog({
      userId: admin.id,
      action: params.deactivated ? "STAFF_ACCOUNT_DEACTIVATED" : "STAFF_ACCOUNT_REACTIVATED",
      entityType: "User",
      entityId: targetUser.id,
      metadata: {
        targetStaffEmail: targetUser.email,
        adminEmail: admin.email,
      },
    });

    revalidatePath("/admin/staff");

    return {
      success: true,
      message: `Staff member ${targetUser.name} has been ${params.deactivated ? "deactivated" : "reactivated"} successfully`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update staff status";
    return { success: false, error: message };
  }
}

