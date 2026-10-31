import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/guards";

export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json({
      authenticated: !!session,
      user: session?.user || null,
    });
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, user: null, error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

