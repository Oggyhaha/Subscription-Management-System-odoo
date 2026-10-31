"use server";

import { revalidatePath } from "next/cache";
import { settingsService, type SystemSettingsConfig } from "@/server/services/settings";
import { requireRole } from "@/server/auth/guards";
import { writeAuditLog } from "@/lib/audit";
import { systemSettingsSchema, type SystemSettingsInput } from "@/schemas/settings";
import type { ActionResult } from "@/server/actions/auth";

/**
 * Retrieves the global system settings (ADMIN and STAFF accessible)
 */
export async function getSettingsAction(): Promise<ActionResult<SystemSettingsConfig>> {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const settings = await settingsService.getSettings();
    return {
      success: true,
      data: settings,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load system settings";
    return { success: false, error: message };
  }
}

/**
 * Updates application configuration and business preferences (ADMIN only)
 */
export async function updateSettingsAction(
  input: SystemSettingsInput
): Promise<ActionResult<SystemSettingsConfig>> {
  try {
    const admin = await requireRole("ADMIN");
    const validated = systemSettingsSchema.parse(input);

    const oldSettings = await settingsService.getSettings();
    const updated = await settingsService.updateSettings(validated);

    await writeAuditLog({
      userId: admin.id,
      action: "SYSTEM_SETTINGS_UPDATED",
      entityType: "SystemSettings",
      entityId: "global",
      oldState: {
        businessName: oldSettings.businessName,
        currency: oldSettings.currency,
        invoiceDueDaysDefault: oldSettings.invoiceDueDaysDefault,
        defaultPaymentTerms: oldSettings.defaultPaymentTerms,
      },
      newState: {
        businessName: updated.businessName,
        currency: updated.currency,
        invoiceDueDaysDefault: updated.invoiceDueDaysDefault,
        defaultPaymentTerms: updated.defaultPaymentTerms,
      },
    });

    revalidatePath("/admin/settings");

    return {
      success: true,
      message: "System settings saved successfully",
      data: updated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save system settings";
    return { success: false, error: message };
  }
}

