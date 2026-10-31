import fs from "fs";
import path from "path";
import { type SystemSettingsInput } from "@/schemas/settings";

export interface SystemSettingsConfig extends SystemSettingsInput {
  deactivatedStaffIds: string[];
}

const SETTINGS_FILE_PATH = path.join(process.cwd(), "src", "server", "config", "settings.json");

const DEFAULT_SETTINGS: SystemSettingsConfig = {
  businessName: "Brightloop Software Inc.",
  supportEmail: "billing@brightloop.com",
  currency: "USD",
  currencySymbol: "$",
  invoiceDueDaysDefault: 30,
  defaultPaymentTerms: "Net 30",
  roundingPolicy: "Banker's Safe ROUND_HALF_UP (2 Decimal Places)",
  addressLine1: "100 Innovation Way, Suite 400",
  city: "San Francisco",
  state: "CA",
  postalCode: "94105",
  country: "US",
  deactivatedStaffIds: [],
};

// In-memory cache for ultra-fast lookups
let cachedSettings: SystemSettingsConfig | null = null;

export class SettingsService {
  /**
   * Retrieves current application settings
   */
  async getSettings(): Promise<SystemSettingsConfig> {
    if (cachedSettings) {
      return cachedSettings;
    }

    try {
      if (fs.existsSync(SETTINGS_FILE_PATH)) {
        const raw = fs.readFileSync(SETTINGS_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        cachedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          deactivatedStaffIds: Array.isArray(parsed.deactivatedStaffIds)
            ? parsed.deactivatedStaffIds
            : [],
        };
        return cachedSettings!;
      }
    } catch {
      // Fallback to defaults if file read fails
    }

    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }

  /**
   * Updates application settings and persists to JSON file
   */
  async updateSettings(input: SystemSettingsInput): Promise<SystemSettingsConfig> {
    const current = await this.getSettings();
    const updated: SystemSettingsConfig = {
      ...current,
      ...input,
      roundingPolicy: DEFAULT_SETTINGS.roundingPolicy, // Read-only policy
      deactivatedStaffIds: current.deactivatedStaffIds,
    };

    try {
      const dir = path.dirname(SETTINGS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist settings file", err);
    }

    cachedSettings = updated;
    return updated;
  }

  /**
   * Checks if staff user is deactivated
   */
  async isStaffDeactivated(staffUserId: string): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.deactivatedStaffIds.includes(staffUserId);
  }

  /**
   * Toggles staff deactivation state
   */
  async setStaffDeactivated(staffUserId: string, deactivated: boolean): Promise<boolean> {
    const current = await this.getSettings();
    const ids = new Set(current.deactivatedStaffIds);

    if (deactivated) {
      ids.add(staffUserId);
    } else {
      ids.delete(staffUserId);
    }

    const updated: SystemSettingsConfig = {
      ...current,
      deactivatedStaffIds: Array.from(ids),
    };

    try {
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to update staff deactivation state", err);
    }

    cachedSettings = updated;
    return deactivated;
  }
}

export const settingsService = new SettingsService();

