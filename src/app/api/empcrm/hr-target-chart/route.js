import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canViewHrTargetChart } from "@/lib/hrTargetEligibleRoles";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { resolveHrUserDesignation } from "@/lib/resolveHrUserDesignation";
import {
  buildItemsForHrUsername,
  computeCompletedForDesignation,
} from "@/lib/hrTargetMonthlyCompleted";

async function hasHrUsernameColumn(conn) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM hr_designation_monthly_targets LIKE 'hr_username'`);
  return rows.length > 0;
}

/**
 * GET: Target vs completed for HR (month/year).
 * Returns `items`: one entry per designation. If Superadmin set multiple targets for this HR (same month/year),
 * all rows with matching hr_username are included.
 */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sessionRole = payload.role ?? payload.userRole;
    if (!canViewHrTargetChart(sessionRole)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    let month = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);
    let year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
    if (Number.isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
    if (Number.isNaN(year) || year < 2000 || year > 2100) year = now.getFullYear();

    const conn = await getDbConnection();
    const withUser = await hasHrUsernameColumn(conn);
    const isSuperadmin = normalizeRoleKey(sessionRole) === "SUPERADMIN";

    if (isSuperadmin) {
      if (!withUser) {
        return NextResponse.json({
          success: true,
          view: "all_hr",
          groups: [],
          month,
          year,
          message:
            "Per-HR targets need column hr_username on hr_designation_monthly_targets. Run the migration add-hr-username script.",
        });
      }
      const [distinctHrs] = await conn.execute(
        `SELECT MIN(hr_username) AS hr_username
         FROM hr_designation_monthly_targets
         WHERE year = ? AND month = ? AND TRIM(hr_username) <> ''
         GROUP BY LOWER(TRIM(hr_username))
         ORDER BY MIN(hr_username) ASC`,
        [year, month]
      );
      const groups = [];
      for (const r of distinctHrs || []) {
        const un = String(r.hr_username || "").trim();
        if (!un) continue;
        const items = await buildItemsForHrUsername(conn, un, year, month);
        if (items.length > 0) groups.push({ hr_username: un, items });
      }
      return NextResponse.json({
        success: true,
        view: "all_hr",
        groups,
        month,
        year,
      });
    }

    const username = payload.username;

    /** @type {{ designation: string, target: number, completed: number }[]} */
    const items = [];

    if (withUser) {
      const fromUser = await buildItemsForHrUsername(conn, username, year, month);
      if (fromUser.length > 0) {
        return NextResponse.json({
          success: true,
          items: fromUser,
          month,
          year,
        });
      }
    }

    const designation = await resolveHrUserDesignation(conn, username);

    if (!designation) {
      return NextResponse.json({
        success: true,
        items: [],
        month,
        year,
        message:
          "No designation found. Add Designation in Employee CRM profile, set User department in employee master, or ask Superadmin to assign a target for your username.",
      });
    }

    let target = 0;
    if (withUser) {
      const [targetRows] = await conn.execute(
        `SELECT target_amount FROM hr_designation_monthly_targets
         WHERE year = ? AND month = ? AND (hr_username IS NULL OR TRIM(hr_username) = '')
           AND LOWER(TRIM(designation)) = LOWER(TRIM(?))
         LIMIT 1`,
        [year, month, designation]
      );
      target = targetRows[0]?.target_amount != null ? Number(targetRows[0].target_amount) : 0;
    } else {
      const [targetRows] = await conn.execute(
        `SELECT target_amount FROM hr_designation_monthly_targets
         WHERE year = ? AND month = ? AND LOWER(TRIM(designation)) = LOWER(TRIM(?))
         LIMIT 1`,
        [year, month, designation]
      );
      target = targetRows[0]?.target_amount != null ? Number(targetRows[0].target_amount) : 0;
    }

    const completed = await computeCompletedForDesignation(conn, username, year, month, designation);

    items.push({
      designation,
      target,
      completed,
    });

    return NextResponse.json({
      success: true,
      items,
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
