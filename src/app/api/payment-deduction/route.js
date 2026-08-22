import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const ALLOWED_ROLES = ["ACCOUNTANT", "PRODUCTION ACCOUNTANT", "ADMIN", "SUPERADMIN"];

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = payload.username || null;
    const role = payload.role || "";
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { order_id, deduction_type, remarks, amount } = await request.json();
    const deductionAmount = parseFloat(amount);

    if (!order_id || !deduction_type || !String(remarks || "").trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(deductionAmount) || deductionAmount <= 0) {
      return NextResponse.json(
        { error: "Deduction amount must be greater than 0" },
        { status: 400 }
      );
    }

    const allowedTypes = ["LD", "SD", "TDS", "Others"];
    if (!allowedTypes.includes(deduction_type)) {
      return NextResponse.json(
        { error: "Invalid deduction type" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    await conn.execute(
      `INSERT INTO payment_deductions 
       (order_id, deduction_type, remarks, amount, recorded_by, recorded_date)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [order_id, deduction_type, String(remarks).trim(), deductionAmount, currentUser]
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
