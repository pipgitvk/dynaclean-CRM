import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePaymentDeductionsTable } from "@/lib/ensurePaymentDeductionsTable";

const ALLOWED_ROLES = ["ACCOUNTANT", "PRODUCTION ACCOUNTANT", "ADMIN", "SUPERADMIN"];

export async function PATCH(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(payload.role || "")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const deductionId = Number(id);
    if (!deductionId) {
      return NextResponse.json({ error: "Invalid deduction id" }, { status: 400 });
    }

    const body = await request.json();
    const claimStatus = String(body.claim_status || "").trim().toLowerCase();
    const claimReceivedDate = body.claim_received_date || null;

    if (!["received", "not received"].includes(claimStatus)) {
      return NextResponse.json({ error: "Invalid claim status" }, { status: 400 });
    }

    const conn = await getDbConnection();
    await ensurePaymentDeductionsTable();

    const [existingRows] = await conn.execute(
      `SELECT id, claimable FROM payment_deductions WHERE id = ?`,
      [deductionId]
    );

    if (!existingRows.length) {
      return NextResponse.json({ error: "Deduction not found" }, { status: 404 });
    }

    if (Number(existingRows[0].claimable) !== 1 && claimStatus === "received") {
      return NextResponse.json(
        { error: "Only claimable deductions can be marked as received" },
        { status: 400 }
      );
    }

    const receivedDate =
      claimStatus === "received"
        ? claimReceivedDate || new Date().toISOString().slice(0, 19).replace("T", " ")
        : null;

    await conn.execute(
      `UPDATE payment_deductions
       SET claim_status = ?, claim_received_date = ?
       WHERE id = ?`,
      [claimStatus, receivedDate, deductionId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating deduction claim:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
