import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  isCreditStatement,
  isDebitStatement,
  isStatementSettled,
} from "@/lib/isStatementSettled";
import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";
import { partyPaymentToken } from "@/lib/partyPaymentStatementLink";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const partyPaymentId = Number(searchParams.get("party_payment_id") || 0);
    const myToken =
      Number.isFinite(partyPaymentId) && partyPaymentId > 0
        ? partyPaymentToken(partyPaymentId)
        : "";

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT id, trans_id, date, type, amount, description, invoice_status,
              linked_purchase_ids, client_expense_id, dd_id, invoice_number,
              linked_module_type, linked_module_id, failed_transaction_id,
              cancelled_transaction_id
       FROM statements
       ORDER BY date DESC, id DESC
       LIMIT 8000`,
    );

    const eligible = (rows || []).filter((row) => {
      const isCredit = isCreditStatement(row);
      const isDebit = isDebitStatement(row);
      if (!isCredit && !isDebit) return false;
      const tokens = parseLinkedPurchaseTokens(row.linked_purchase_ids);
      const linkedToThis = myToken && tokens.includes(myToken);
      if (linkedToThis) return true;
      return !isStatementSettled(row);
    });

    return NextResponse.json({ success: true, data: eligible });
  } catch (err) {
    console.error("[party-payments/unsettled-statements] GET:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}
