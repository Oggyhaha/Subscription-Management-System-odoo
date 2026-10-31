import { NextResponse } from "next/server";
import { getCustomerDashboardAction } from "@/server/actions/customer-portal";

export async function GET() {
  const result = await getCustomerDashboardAction();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data);
}

