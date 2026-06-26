import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

export async function GET() {
  try {
    const payload = await getSessionPayload();

    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        username: payload.username,
        role: payload.role || payload.userRole,
        email: payload.email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch current user:", error);
    return NextResponse.json(
      { error: "Failed to fetch current user." },
      { status: 500 }
    );
  }
}
