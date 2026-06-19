import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function POST(request) {
  try {
    // Verify user
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let currentUser = null;
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(JWT_SECRET)
      );
      currentUser = payload.username || null;
    } catch (e) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { order_id, deduction_type, remarks, amount } = await request.json();

    if (!order_id || !deduction_type || !remarks) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Insert deduction record
    await conn.execute(
      `INSERT INTO payment_deductions 
       (order_id, deduction_type, remarks, amount, recorded_by, recorded_date)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [order_id, deduction_type, remarks, amount || 0, currentUser]
    );

    return NextResponse.json(
      { success: true, message: "Deduction recorded successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error recording deduction:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
