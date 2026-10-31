import { NextResponse } from "next/server";
import { settingsService } from "@/server/services/settings";
import { requireRole } from "@/server/auth/guards";

export async function GET() {
  try {
    await requireRole(["ADMIN", "STAFF"]);
    const settings = await settingsService.getSettings();
    return NextResponse.json(settings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

