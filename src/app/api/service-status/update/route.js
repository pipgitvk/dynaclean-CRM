import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { ensureServiceRecordsPlannedDateColumn } from "@/lib/ensureServiceRecordsPlannedDateColumn";
import {
  reopenOrdersWithoutCompletedServiceReport,
  syncInstallationOrderStatusMarkOnly,
} from "@/lib/syncInstalledOrdersFromServiceReports";

function normalizePlannedDate(value) {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

async function updateServiceRecordWithRetry(conn, params, maxAttempts = 4) {
  const sql = `UPDATE service_records
       SET status = ?, status_description = ?, planned_date = ?
       WHERE service_id = ?`;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await conn.execute(sql, params);
    } catch (error) {
      lastError = error;
      if (error?.code !== "ER_LOCK_WAIT_TIMEOUT" || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }
  throw lastError;
}

function runInstallationSyncInBackground(conn, { wasCompleted, nowCompleted }) {
  if (!wasCompleted && !nowCompleted) return;

  const run = async () => {
    try {
      if (nowCompleted) {
        await syncInstallationOrderStatusMarkOnly(conn);
      } else if (wasCompleted) {
        await reopenOrdersWithoutCompletedServiceReport(conn);
      }
    } catch (syncErr) {
      console.error(
        "installation order sync after status update:",
        syncErr?.message || syncErr,
      );
    }
  };

  void run();
}

export async function POST(req) {
  try {
    const { service_id, status, description, planned_date } = await req.json();

    if (!service_id || !status) {
      return NextResponse.json(
        { success: false, message: "service_id and status are required" },
        { status: 400 },
      );
    }

    const normalizedStatus = String(status).trim();
    const desc =
      normalizedStatus.toUpperCase() === "PENDING BY CUSTOMER"
        ? (description || "").trim()
        : (description || "").trim() || null;

    if (
      normalizedStatus.toUpperCase() === "PENDING BY CUSTOMER" &&
      (!desc || desc.length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Description is required when status is PENDING BY CUSTOMER",
        },
        { status: 400 },
      );
    }

    const isPlanned = normalizedStatus.toUpperCase() === "PLANNED";
    const plannedDate = isPlanned ? normalizePlannedDate(planned_date) : null;
    if (isPlanned && !plannedDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Planned date is required when status is PLANNED",
        },
        { status: 400 },
      );
    }

    await ensureServiceRecordsPlannedDateColumn();
    const conn = await getDbConnection();

    const [[existing]] = await conn.execute(
      `SELECT status FROM service_records WHERE service_id = ? LIMIT 1`,
      [service_id],
    );
    const previousStatus = String(existing?.status || "")
      .trim()
      .toUpperCase();
    const nowCompleted = normalizedStatus.toUpperCase() === "COMPLETED";
    const wasCompleted = previousStatus === "COMPLETED";

    await updateServiceRecordWithRetry(conn, [
      normalizedStatus,
      desc,
      plannedDate,
      service_id,
    ]);

    runInstallationSyncInBackground(conn, { wasCompleted, nowCompleted });

    return NextResponse.json({ success: true, message: "Status updated" });
  } catch (error) {
    console.error("Error updating service status:", error);
    const isLock =
      error?.code === "ER_LOCK_WAIT_TIMEOUT" ||
      error?.errno === 1205;
    return NextResponse.json(
      {
        success: false,
        message: isLock
          ? "Database is busy. Please try again in a few seconds."
          : "Internal server error",
      },
      { status: isLock ? 503 : 500 },
    );
  }
}
