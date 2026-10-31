import { NextResponse } from "next/server";
import { listStaffAction } from "@/server/actions/staff";

export async function GET() {
  const result = await listStaffAction();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data);
}

