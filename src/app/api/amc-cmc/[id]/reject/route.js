import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(request, { params }) {
  const { id } = await params;

  let conn;
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    conn = await getDbConnection();

    const [existing] = await conn.execute(
      "SELECT * FROM amc_cmc WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "AMC/CMC record not found" },
        { status: 404 }
      );
    }

    await conn.execute(
      `UPDATE amc_cmc SET status = ?, approved_by = ?, approved_time = ? WHERE id = ?`,
      ["rejected", payload.username, new Date(), id]
    );

    return NextResponse.json({
      success: true,
      message: "AMC/CMC record rejected successfully",
    });
  } catch (error) {
    console.error("Error rejecting AMC/CMC record:", error);
    return NextResponse.json(
      { error: "Failed to reject AMC/CMC record", details: error.message },
      { status: 500 }
    );
  }
}
