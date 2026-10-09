import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  calculateContinuousLeaveDays,
  fetchCompanyHolidays,
} from "@/lib/leaveContinuousDays";
import {
  expandUnpaidSandwichSpan,
  SANDWICH_LEAVE_TYPES,
  unpaidLeavesForPendingSandwichPreview,
} from "@/lib/unpaidLeaveSandwich";

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from_date = searchParams.get("from_date");
    const to_date = searchParams.get("to_date");
    const leave_type = searchParams.get("leave_type") || "";
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

    const requested = calculateContinuousLeaveDays(from_date, to, holidays);

    let totalDaysAfterApproval = null;
    let afterApprovalBreakdown = null;
    let sandwichAfterApproval = false;
    let effectiveFromAfterApproval = null;
    let effectiveToAfterApproval = null;

    if (SANDWICH_LEAVE_TYPES.includes(leave_type)) {
      const [existingRows] = await conn.execute(
        `SELECT id, from_date, to_date, is_half_day, status
         FROM employee_leaves
         WHERE username = ?
           AND leave_type = ?
           AND status IN ('pending', 'approved')`,
        [session.username, leave_type]
      );
      const previewPool = unpaidLeavesForPendingSandwichPreview(existingRows);
      const hypotheticalPool = [
        ...previewPool,
        {
          id: -1,
          from_date,
          to_date: to,
          is_half_day: 0,
          status: "pending",
        },
      ];
      const sandwich = expandUnpaidSandwichSpan(
        from_date,
        to,
        hypotheticalPool,
        holidays
      );
      const after = calculateContinuousLeaveDays(
        sandwich.from_date,
        sandwich.to_date,
        holidays
      );
      totalDaysAfterApproval = after.totalDays;
      afterApprovalBreakdown = after.breakdown;
      effectiveFromAfterApproval = sandwich.from_date;
      effectiveToAfterApproval = sandwich.to_date;
      sandwichAfterApproval = totalDaysAfterApproval > requested.totalDays;
    }

    return NextResponse.json({
      success: true,
      totalDays: requested.totalDays,
      breakdown: requested.breakdown,
      rule: "continuous",
      totalDaysAfterApproval,
      afterApprovalBreakdown,
      sandwichAfterApproval,
      from_date_after_approval: effectiveFromAfterApproval,
      to_date_after_approval: effectiveToAfterApproval,
    });
  } catch (error) {
    console.error("Leave preview-days error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
