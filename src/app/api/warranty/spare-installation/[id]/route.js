import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";
import { ensureSpareInstallationRecordsTable } from "@/lib/ensureSpareInstallationRecordsTable";
import { ensureServiceRecordsPlannedDateColumn } from "@/lib/ensureServiceRecordsPlannedDateColumn";
import { ensureServiceRecordsInstallationManualColumns } from "@/lib/ensureServiceRecordsInstallationManualColumns";

function isoDateOnly(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s.slice(0, 10);
}

const ALLOWED = new Set(["PENDING", "PLANNED", "COMPLETED"]);

export async function PATCH(req, { params }) {
  const token = req.cookies.get("token")?.value;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = parseInt(String(idParam || ""), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const rawStatus = body.status;
  const hasStatus =
    rawStatus !== undefined &&
    rawStatus !== null &&
    String(rawStatus).trim() !== "";
  const hasAssign = body.assigned_to !== undefined;

  if (!hasStatus && !hasAssign) {
    return NextResponse.json(
      { message: "Provide status and/or assigned_to" },
      { status: 400 },
    );
  }

  let status = null;
  if (hasStatus) {
    status = String(rawStatus).trim().toUpperCase();
    if (!ALLOWED.has(status)) {
      return NextResponse.json(
        { message: "Status must be PENDING, PLANNED, or COMPLETED" },
        { status: 400 },
      );
    }
  }

  let assignedTo = null;
  if (hasAssign) {
    assignedTo = String(body.assigned_to || "").trim() || "NOT ASSIGNED";
  }

  try {
    const pool = await getDbConnection();
    await ensureSpareInstallationRecordsTable(pool);
    await ensureServiceRecordsPlannedDateColumn();
    await ensureServiceRecordsInstallationManualColumns(pool);

    const [rows] = await pool.execute(
      `SELECT id, registered_spare_id, service_record_id, status
       FROM spare_installation_records WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!rows.length) {
      return NextResponse.json({ message: "Record not found" }, { status: 404 });
    }
    const row = rows[0];
    const currentStatus = String(row.status || "")
      .trim()
      .toUpperCase();

    if (hasStatus) {
      if (
        currentStatus === "COMPLETED" &&
        status &&
        status !== "COMPLETED"
      ) {
        return NextResponse.json(
          { message: "Completed spare records cannot be reverted." },
          { status: 400 },
        );
      }
      const plannedDate = isoDateOnly(body.planned_date);
      const completedDate = isoDateOnly(body.completed_date);
      const completedBy = String(body.completed_by || "").trim();

      if (status === "PLANNED" && !plannedDate) {
        return NextResponse.json(
          { message: "Planned date is required" },
          { status: 400 },
        );
      }
      if (status === "COMPLETED" && (!completedDate || !completedBy)) {
        return NextResponse.json(
          { message: "Completed by and completed date are required" },
          { status: 400 },
        );
      }

      if (status === "PLANNED") {
        await pool.execute(
          `UPDATE spare_installation_records
           SET status = ?, planned_date = ?, updated_at = NOW()
           WHERE id = ?`,
          [status, plannedDate, id],
        );
      } else if (status === "COMPLETED") {
        await pool.execute(
          `UPDATE spare_installation_records
           SET status = ?, completed_by = ?, completed_date = ?, updated_at = NOW()
           WHERE id = ?`,
          [status, completedBy, completedDate, id],
        );
      } else {
        await pool.execute(
          `UPDATE spare_installation_records
           SET status = ?, planned_date = NULL, updated_at = NOW()
           WHERE id = ?`,
          [status, id],
        );
      }

      if (row.registered_spare_id) {
        const spareStatus =
          status === "COMPLETED"
            ? "completed"
            : status === "PLANNED"
              ? "planned"
              : "pending";
        if (status === "COMPLETED") {
          await pool.execute(
            `UPDATE registered_spares
             SET spare_installation_status = ?,
                 installation_completed_by = ?,
                 installation_completed_date = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [spareStatus, completedBy, completedDate, row.registered_spare_id],
          );
        } else {
          await pool.execute(
            `UPDATE registered_spares
             SET spare_installation_status = ?, updated_at = NOW()
             WHERE id = ?`,
            [spareStatus, row.registered_spare_id],
          );
        }
      }

      if (row.service_record_id) {
        const srStatus =
          status === "COMPLETED"
            ? "COMPLETED"
            : status === "PLANNED"
              ? "PLANNED"
              : "PENDING";
        if (status === "PLANNED") {
          await pool.execute(
            `UPDATE service_records
             SET status = ?, planned_date = ? WHERE service_id = ?`,
            [srStatus, plannedDate, row.service_record_id],
          );
        } else if (status === "COMPLETED") {
          await pool.execute(
            `UPDATE service_records
             SET status = ?,
                 completed_date = ?,
                 completed_by_service_engineer = ?,
                 installation_completion_date = ?
             WHERE service_id = ?`,
            [
              srStatus,
              completedDate,
              completedBy,
              completedDate,
              row.service_record_id,
            ],
          );
        } else {
          await pool.execute(
            `UPDATE service_records SET status = ?, planned_date = NULL WHERE service_id = ?`,
            [srStatus, row.service_record_id],
          );
        }
      }
    }

    if (hasAssign) {
      await pool.execute(
        `UPDATE spare_installation_records SET assigned_to = ?, updated_at = NOW() WHERE id = ?`,
        [assignedTo, id],
      );
      if (row.service_record_id) {
        await pool.execute(
          `UPDATE service_records SET assigned_to = ? WHERE service_id = ?`,
          [assignedTo, row.service_record_id],
        );
      }
    }

    return NextResponse.json({
      success: true,
      ...(hasStatus ? { status } : {}),
      ...(hasAssign ? { assigned_to: assignedTo } : {}),
    });
  } catch (error) {
    console.error("PATCH spare-installation:", error);
    return NextResponse.json({ message: error.message || "Server error" }, { status: 500 });
  }
}