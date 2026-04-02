import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

/** DELETE a single row in customers_followup by customer_id + time_stamp (admin tooling). */
export async function DELETE(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id");
    const timeStamp = searchParams.get("time_stamp");

    if (!customerId || !timeStamp) {
      return NextResponse.json(
        { error: "customer_id and time_stamp are required" },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();
    const connection = await pool.getConnection();

    try {
      const [result] = await connection.execute(
        `DELETE FROM customers_followup WHERE customer_id = ? AND time_stamp = ?`,
        [customerId, timeStamp]
      );

      if (result.affectedRows === 0) {
        return NextResponse.json(
          { error: "No matching follow-up found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Employee follow-up deleted successfully",
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error deleting employee follow-up:", error);
    return NextResponse.json(
      { error: "Failed to delete employee follow-up" },
      { status: 500 }
    );
  }
}
