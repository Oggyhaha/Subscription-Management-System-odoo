import { NextRequest, NextResponse } from "next/server";
import { CustomerService } from "@/server/services/customer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await CustomerService.getCustomerById(id);
    return NextResponse.json({ data: customer });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch customer profile" },
      { status: error.statusCode || 500 }
    );
  }
}
