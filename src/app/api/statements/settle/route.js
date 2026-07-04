import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// POST /api/statements/settle
// Settle matching debit and credit statements with same amount
export async function POST(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { debit_id, credit_id, amount } = body;

    if (!debit_id || !credit_id || !amount) {
      return NextResponse.json(
        { error: "debit_id, credit_id, and amount are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Verify both statements exist and have matching amounts with opposite types
    const [[debitStmt]] = await conn.execute(
      `SELECT id, type, amount FROM statements WHERE id = ? LIMIT 1`,
      [debit_id]
    );
    const [[creditStmt]] = await conn.execute(
      `SELECT id, type, amount FROM statements WHERE id = ? LIMIT 1`,
      [credit_id]
    );

    if (!debitStmt || !creditStmt) {
      return NextResponse.json({ error: "One or both statements not found" }, { status: 404 });
    }

    if (debitStmt.type === creditStmt.type) {
      return NextResponse.json(
        { error: "Both statements must have opposite types (Debit & Credit)" },
        { status: 400 }
      );
    }

    const debitAmount = Math.abs(Number(debitStmt.amount || 0));
    const creditAmount = Math.abs(Number(creditStmt.amount || 0));
    if (Math.abs(debitAmount - creditAmount) > 0.01) {
      return NextResponse.json(
        { error: `Amounts don't match: ${debitAmount} vs ${creditAmount}` },
        { status: 400 }
      );
    }

    // Mark both as settled by setting invoice_status to "Settled"
    await conn.execute(
      `UPDATE statements SET invoice_status = 'Settled', linked_module_type = 'Matched_Pair', linked_module_id = ? WHERE id = ?`,
      [credit_id, debit_id]
    );
    await conn.execute(
      `UPDATE statements SET invoice_status = 'Settled', linked_module_type = 'Matched_Pair', linked_module_id = ? WHERE id = ?`,
      [debit_id, credit_id]
    );

    return NextResponse.json({
      success: true,
      message: "Statements settled successfully",
      debit_id,
      credit_id,
      amount: debitAmount,
    });
  } catch (err) {
    console.error("[statements/settle POST]", err?.message);
    return NextResponse.json({ error: "DB error", detail: err?.message }, { status: 500 });
  }
}
