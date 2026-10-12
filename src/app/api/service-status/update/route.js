import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { ensureServiceRecordsPlannedDateColumn } from "@/lib/ensureServiceRecordsPlannedDateColumn";

function normalizePlannedDate(value) {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export async function POST(req) {
  try {
    const { service_id, status, description, planned_date } = await req.json();

    if (!service_id || !status) {
      return NextResponse.json(
        { success: false, message: "service_id and status are required" },
        { status: 400 }
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
        { status: 400 }
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
        { status: 400 }
      );
    }

    await ensureServiceRecordsPlannedDateColumn();
    const conn = await getDbConnection();
    await conn.execute(
      `UPDATE service_records
       SET status = ?, status_description = ?, planned_date = ?
       WHERE service_id = ?`,
      [normalizedStatus, desc, plannedDate, service_id]
    );
    // await conn.end();

    return NextResponse.json({ success: true, message: "Status updated" });
  } catch (error) {
    console.error("Error updating service status:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
