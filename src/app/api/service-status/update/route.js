import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  try {
    const { service_id, status, description } = await req.json();

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

    const conn = await getDbConnection();
    await conn.execute(
      "UPDATE service_records SET status = ?, status_description = ? WHERE service_id = ?",
      [normalizedStatus, desc, service_id]
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
