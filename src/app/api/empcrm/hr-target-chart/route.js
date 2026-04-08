import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { isHrTargetDashboardRole } from "@/lib/hrTargetEligibleRoles";
import { resolveHrUserDesignation } from "@/lib/resolveHrUserDesignation";

async function hasHrUsernameColumn(conn) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM hr_designation_monthly_targets LIKE 'hr_username'`);
  return rows.length > 0;
}

/**
 * GET: Target vs completed for HR (month/year).
 * Target row match order:
 * 1) Row with hr_username = logged-in user (if column exists)
 * 2) Row with hr_username empty and designation = profile designation or rep_list.userDepartment
 */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!isHrTargetDashboardRole(payload.role ?? payload.userRole)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    let month = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);
    let year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
    if (Number.isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
    if (Number.isNaN(year) || year < 2000 || year > 2100) year = now.getFullYear();

    const conn = await getDbConnection();
    const username = payload.username;
    const withUser = await hasHrUsernameColumn(conn);

    let target = 0;
    let labelDesignation = "";
    let matchedByUsername = false;

    if (withUser) {
      const [userRows] = await conn.execute(
        `SELECT target_amount, designation FROM hr_designation_monthly_targets
         WHERE year = ? AND month = ? AND TRIM(hr_username) <> ''
           AND LOWER(TRIM(hr_username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(?)) COLLATE utf8mb4_unicode_ci
         LIMIT 1`,
        [year, month, username]
      );
      if (userRows.length > 0) {
        target = userRows[0]?.target_amount != null ? Number(userRows[0].target_amount) : 0;
        labelDesignation = String(userRows[0]?.designation || "").trim();
        matchedByUsername = true;
      }
    }

    if (!matchedByUsername) {
      const designation = await resolveHrUserDesignation(conn, username);

      if (!designation) {
        return NextResponse.json({
          success: true,
          designation: null,
          target: 0,
          completed: 0,
          month,
          year,
          message:
            "No designation found. Add Designation in Employee CRM profile, set User department in employee master, or ask Superadmin to assign a target for your username.",
        });
      }

      labelDesignation = designation;

      if (withUser) {
        const [targetRows] = await conn.execute(
          `SELECT target_amount FROM hr_designation_monthly_targets
           WHERE year = ? AND month = ? AND (hr_username IS NULL OR TRIM(hr_username) = '')
             AND LOWER(TRIM(designation)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(?)) COLLATE utf8mb4_unicode_ci
           LIMIT 1`,
          [year, month, designation]
        );
        target = targetRows[0]?.target_amount != null ? Number(targetRows[0].target_amount) : 0;
      } else {
        const [targetRows] = await conn.execute(
          `SELECT target_amount FROM hr_designation_monthly_targets
           WHERE year = ? AND month = ? AND LOWER(TRIM(designation)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(?)) COLLATE utf8mb4_unicode_ci
           LIMIT 1`,
          [year, month, designation]
        );
        target = targetRows[0]?.target_amount != null ? Number(targetRows[0].target_amount) : 0;
      }
    }

    const forCompletedDesignation = (labelDesignation || "").trim();
    let completed = 0;
    if (forCompletedDesignation) {
      try {
        // Avoid JOIN neworder ↔ employee_profiles (mixed utf8mb4 collations cause ER_CANT_AGGREGATE_2COLLATIONS).
        const [nameRows] = await conn.execute(
          `SELECT username FROM employee_profiles
           WHERE LOWER(TRIM(COALESCE(designation, ''))) = LOWER(TRIM(?))`,
          [forCompletedDesignation]
        );
        const names = (nameRows || []).map((r) => String(r.username || "").trim()).filter(Boolean);
        if (names.length > 0) {
          const ph = names.map(() => "?").join(", ");
          const [sumRows] = await conn.execute(
            `SELECT COALESCE(SUM(COALESCE(totalamt, 0)), 0) AS completed
             FROM neworder
             WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
               AND LOWER(TRIM(COALESCE(created_by, ''))) IN (${ph})`,
            [year, month, ...names.map((n) => n.toLowerCase())]
          );
          completed = sumRows[0]?.completed != null ? Number(sumRows[0].completed) : 0;
        }
      } catch (sumErr) {
        console.error("[hr-target-chart] completed sum skipped:", sumErr?.message || sumErr);
        completed = 0;
      }
    }

    return NextResponse.json({
      success: true,
      designation: labelDesignation || null,
      target,
      completed,
      month,
      year,
    });
  } catch (error) {
    console.error("[hr-target-chart]", error);
    const msg = error?.message || "";
    if (msg.includes("hr_designation_monthly_targets") || msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Targets table missing. Run migration: admin-dashboard/hr-designation-targets/migration_hr_designation_monthly_targets.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
