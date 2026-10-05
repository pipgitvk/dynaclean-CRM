import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  calculateContinuousLeaveDays,
  fetchCompanyHolidays,
} from "@/lib/leaveContinuousDays";

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from_date = searchParams.get("from_date");
    const to_date = searchParams.get("to_date");
    const is_half_day = searchParams.get("is_half_day") === "1" || searchParams.get("is_half_day") === "true";

    if (!from_date) {
      return NextResponse.json({ success: false, error: "from_date is required" }, { status: 400 });
    }

    const to = to_date || from_date;

    if (is_half_day) {
      return NextResponse.json({
        success: true,
        totalDays: 0.5,
        breakdown: { weekdays: 0, sundays: 0, holidays: 0 },
        rule: "half_day",
      });
    }

    const conn = await getDbConnection();
    const holidays = await fetchCompanyHolidays(conn);
    const { totalDays, breakdown } = calculateContinuousLeaveDays(from_date, to, holidays);

    return NextResponse.json({
      success: true,
      totalDays,
      breakdown,
      rule: "continuous",
    });
  } catch (error) {
    console.error("Leave preview-days error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
