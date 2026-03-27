// /api/attendance/checkout/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const username = cookies().get("username")?.value;
  if (!username) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  return NextResponse.json(
    {
      error:
        "Legacy checkout endpoint is disabled. Use the attendance checkout flow with GPS location.",
    },
    { status: 410 }
  );
}
