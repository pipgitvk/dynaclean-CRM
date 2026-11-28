import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";
import { canProcessExpensePaymentRole } from "@/lib/roleKeyUtils";

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    );

    if (!canProcessExpensePaymentRole(payload.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { expenseId, paymentDate, paymentRef, notes } = body;

  let conn;

  try {
    conn = await getDbConnection();

    const result = await conn.query(
      `UPDATE expenses SET payment_date = ?, payment_ref = ?, notes = ? WHERE ID = ?`,
      [paymentDate, paymentRef, notes, expenseId]
    );



    return NextResponse.json({
      message: "Payment details updated successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
