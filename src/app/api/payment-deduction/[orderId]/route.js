import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function GET(req, { params }) {
  const { orderId } = await params;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const conn = await getDbConnection();

    const [rows] = await conn.execute(
      `SELECT 
        id,
        order_id,
        deduction_type,
        remarks,
        amount,
        recorded_by,
        recorded_date
       FROM payment_deductions
       WHERE order_id = ?
       ORDER BY recorded_date DESC`,
      [orderId]
    );

    return NextResponse.json({
      success: true,
      deductions: rows || []
    });
  } catch (error) {
    console.error("Error fetching deductions:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
