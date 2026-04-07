import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessDigitalMarketerLeadsModule,
  canReassignLeadAsAdmin,
  isDigitalMarketerRole,
  isDmModuleOnlyAssigneeUsername,
} from "@/lib/digitalMarketerLeadsAuth";
export async function POST(request) {
  let connection;
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roleRaw = payload.role ?? payload.userRole;
    if (!canAccessDigitalMarketerLeadsModule(roleRaw)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const customer_id = Number(body?.customer_id);
    const employee_username = body?.employee_username;

    if (!customer_id || !employee_username) {
      return NextResponse.json(
        { error: "customer_id and employee_username are required" },
        { status: 400 },
      );
    }

    if (!isDmModuleOnlyAssigneeUsername(employee_username)) {
      return NextResponse.json(
        { error: "This module only allows re-assign to KAVYA." },
        { status: 400 },
      );
    }

    const asAdmin = canReassignLeadAsAdmin(roleRaw);
    const asDm = isDigitalMarketerRole(roleRaw);

    const pool = await getDbConnection();
    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT customer_id,
              COALESCE(dm_reassign_exhausted, 0) AS dm_reassign_exhausted
       FROM customers
       WHERE customer_id = ?`,
      [customer_id],
    );

    if (!existing.length) {
      await connection.rollback();
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const row = existing[0];
    if (Number(row.dm_reassign_exhausted) === 1 && asDm) {
      await connection.rollback();
      return NextResponse.json(
        {
          error:
            "You already re-assigned this lead once. Only Super Admin can re-assign it now.",
        },
        { status: 403 },
      );
    }

    const setDmFlag = asDm ? ", dm_reassign_exhausted = 1" : "";
    const whereDmBlock =
      asDm ? " AND COALESCE(dm_reassign_exhausted, 0) = 0" : "";

    const [result] = await connection.execute(
      `UPDATE customers
       SET
         lead_source = ?,
         assigned_to = ?,
         sales_representative = ?,
         status = CASE
           WHEN LOWER(COALESCE(status, '')) = 'denied' THEN 'old_reassign'
           ELSE status
         END
         ${setDmFlag}
       WHERE customer_id = ?
         AND date_created >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         ${whereDmBlock}`,
      [
        employee_username,
        payload.username,
        employee_username,
        customer_id,
      ],
    );

    const affected = result?.affectedRows ?? 0;
    if (affected === 0) {
      await connection.rollback();
      return NextResponse.json(
        {
          error:
            "Lead not found, older than 24 hours, or this lead was already re-assigned by a Digital Marketer.",
        },
        { status: 400 },
      );
    }

    await connection.execute(
      `UPDATE TL_followups SET assigned_employee = ? WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
      [employee_username, customer_id],
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: `Lead assigned to ${employee_username} successfully`,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        /* ignore */
      }
    }
    console.error("digital-marketer-leads reassign:", error);
    const msg = error?.message || "";
    if (/Unknown column ['\"]dm_reassign_exhausted['\"]/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Database migration required: run npm run migrate:dm-reassign-exhausted",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "Failed to re-assign lead" },
      { status: 500 },
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
