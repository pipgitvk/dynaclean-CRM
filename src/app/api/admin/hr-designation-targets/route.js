import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

function assertSuperadmin(payload) {
  if (!payload?.username) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const roleKey = normalizeRoleKey(payload.role ?? payload.userRole);
  if (roleKey !== "SUPERADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function hasHrUsernameColumn(conn) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM hr_designation_monthly_targets LIKE 'hr_username'`);
  return rows.length > 0;
}

/** GET: list targets (optional ?year= & ?month=) */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    const conn = await getDbConnection();
    const withUser = await hasHrUsernameColumn(conn);
    const selectCols = withUser
      ? `id, designation, hr_username, target_amount, month, year, created_at, updated_at`
      : `id, designation, target_amount, month, year, created_at, updated_at`;

    let sql = `SELECT ${selectCols} FROM hr_designation_monthly_targets WHERE 1=1`;
    const params = [];
    if (year != null && year !== "") {
      sql += ` AND year = ?`;
      params.push(parseInt(year, 10));
    }
    if (month != null && month !== "") {
      sql += ` AND month = ?`;
      params.push(parseInt(month, 10));
    }
    sql += ` ORDER BY year DESC, month DESC, designation ASC`;

    const [rows] = await conn.execute(sql, params);
    return NextResponse.json({ success: true, targets: rows, hasHrUsernameColumn: withUser });
  } catch (error) {
    console.error("[admin/hr-designation-targets GET]", error);
    const msg = error?.message || "";
    if (msg.includes("hr_designation_monthly_targets") || msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Table missing. Run migration: admin-dashboard/hr-designation-targets/migration_hr_designation_monthly_targets.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

/** POST: create or replace target (optional hr_username: only that login sees this row) */
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
    if (denied) return denied;

    const body = await request.json();
    const designation = String(body.designation ?? "").trim();
    const hr_username = String(body.hr_username ?? "").trim();
    const target_amount = Number(body.target_amount ?? body.target ?? NaN);
    const month = parseInt(body.month, 10);
    const year = parseInt(body.year, 10);

    if (!designation) {
      return NextResponse.json({ success: false, error: "Designation is required" }, { status: 400 });
    }
    if (!Number.isFinite(target_amount) || target_amount < 0) {
      return NextResponse.json({ success: false, error: "Valid target amount is required" }, { status: 400 });
    }
    if (Number.isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ success: false, error: "Month must be 1–12" }, { status: 400 });
    }
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Valid year is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const withUser = await hasHrUsernameColumn(conn);

    if (withUser) {
      await conn.execute(
        `INSERT INTO hr_designation_monthly_targets (designation, hr_username, target_amount, month, year)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE target_amount = VALUES(target_amount), updated_at = CURRENT_TIMESTAMP`,
        [designation, hr_username, target_amount, month, year]
      );
    } else {
      await conn.execute(
        `INSERT INTO hr_designation_monthly_targets (designation, target_amount, month, year)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE target_amount = VALUES(target_amount), updated_at = CURRENT_TIMESTAMP`,
        [designation, target_amount, month, year]
      );
    }

    return NextResponse.json({ success: true, message: "Target saved" });
  } catch (error) {
    console.error("[admin/hr-designation-targets POST]", error);
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}

/** PATCH: update row by id (Superadmin). */
export async function PATCH(request) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
    if (denied) return denied;

    const body = await request.json();
    const id = parseInt(body.id, 10);
    const designation = String(body.designation ?? "").trim();
    const hr_username = String(body.hr_username ?? "").trim();
    const target_amount = Number(body.target_amount ?? body.target ?? NaN);
    const month = parseInt(body.month, 10);
    const year = parseInt(body.year, 10);

    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ success: false, error: "Valid id is required" }, { status: 400 });
    }
    if (!designation) {
      return NextResponse.json({ success: false, error: "Designation is required" }, { status: 400 });
    }
    if (!Number.isFinite(target_amount) || target_amount < 0) {
      return NextResponse.json({ success: false, error: "Valid target amount is required" }, { status: 400 });
    }
    if (Number.isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ success: false, error: "Month must be 1–12" }, { status: 400 });
    }
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Valid year is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const withUser = await hasHrUsernameColumn(conn);

    if (withUser) {
      if (!hr_username) {
        return NextResponse.json({ success: false, error: "HR username is required" }, { status: 400 });
      }
      await conn.execute(
        `UPDATE hr_designation_monthly_targets
         SET designation = ?, hr_username = ?, target_amount = ?, month = ?, year = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [designation, hr_username, target_amount, month, year, id]
      );
    } else {
      await conn.execute(
        `UPDATE hr_designation_monthly_targets
         SET designation = ?, target_amount = ?, month = ?, year = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [designation, target_amount, month, year, id]
      );
    }

    return NextResponse.json({ success: true, message: "Target updated" });
  } catch (error) {
    console.error("[admin/hr-designation-targets PATCH]", error);
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate") || msg.includes("duplicate")) {
      return NextResponse.json(
        { success: false, error: "A row already exists for this HR, designation, month and year." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}

/** DELETE ?id= */
export async function DELETE(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    await conn.execute(`DELETE FROM hr_designation_monthly_targets WHERE id = ?`, [parseInt(id, 10)]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/hr-designation-targets DELETE]", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
