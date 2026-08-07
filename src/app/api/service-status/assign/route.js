import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  try {
    const { service_id, assigned_to } = await req.json();

    if (!service_id || !assigned_to) {
      return NextResponse.json(
        { success: false, message: "service_id and assigned_to are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [result] = await conn.execute(
      "UPDATE service_records SET assigned_to = ? WHERE service_id = ?",
      [assigned_to.trim(), service_id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "No record found with that Service ID." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Assigned successfully" });
  } catch (error) {
    console.error("Error assigning service:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
