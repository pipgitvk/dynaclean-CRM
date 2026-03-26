import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { fetchMergedAttendanceRulesForUser } from "@/lib/fetchMergedAttendanceRules";

/** GET — merged company + per-employee rules (late / half-day / breaks) */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rules = await fetchMergedAttendanceRulesForUser(payload.username);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("empcrm attendance-rules GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
