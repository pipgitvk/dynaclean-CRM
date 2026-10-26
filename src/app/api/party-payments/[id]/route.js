import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePartyPaymentsTable } from "@/lib/ensurePartyPaymentsTable";
import { normalizePartyPaymentAmounts } from "@/lib/partyPaymentsCompute";
import {
  parsePartyPaymentLinkedStatementIds,
  sumStatementCreditAmounts,
  syncPartyPaymentStatementLinks,
  unlinkAllStatementsForPartyPayment,
} from "@/lib/partyPaymentStatementLink";
import { syncPartyPaymentInHistoryFromStatements } from "@/lib/partyPaymentHistory";

function parseLinkedIdsFromBody(body) {
  const raw = body?.linked_statement_ids;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function parsePaymentDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function PUT(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const customer_id = String(body.customer_id || "").trim();
    const phone = String(body.phone || "").trim();
    if (!customer_id) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 },
      );
    }
    if (!phone) {
      return NextResponse.json(
        { error: "Phone is required" },
        { status: 400 },
      );
    }
    const name = String(body.name || "").trim();

    const linkedStatementIds = parseLinkedIdsFromBody(body);
    let amounts = normalizePartyPaymentAmounts(body);
    let paymentDate = parsePaymentDate(body.payment_date);

    const conn = await getDbConnection();
    await ensurePartyPaymentsTable(conn);

    const [existingRows] = await conn.execute(
      `SELECT linked_statement_ids FROM party_payments WHERE id = ? LIMIT 1`,
      [id],
    );
    const previousLinked = parsePartyPaymentLinkedStatementIds(
      existingRows?.[0]?.linked_statement_ids,
    );

    if (linkedStatementIds.length) {
      const summed = await sumStatementCreditAmounts(conn, linkedStatementIds);
      amounts = normalizePartyPaymentAmounts({
        ...body,
        amount_in: summed.total,
        amount_out: amounts.amount_out,
      });
      if (!paymentDate && summed.latestDate) paymentDate = summed.latestDate;
    }

    const [result] = await conn.execute(
      `UPDATE party_payments SET
        customer_id = ?, name = ?, company_name = ?, phone = ?, payment_date = ?,
        amount_in = ?, amount_out = ?, balance = ?, status = ?,
        linked_statement_ids = ?
       WHERE id = ?`,
      [
        customer_id,
        name,
        String(body.company_name || "").trim(),
        phone,
        paymentDate,
        amounts.amount_in,
        amounts.amount_out,
        amounts.balance,
        amounts.status,
        linkedStatementIds.length ? JSON.stringify(linkedStatementIds) : null,
        id,
      ],
    );

    await syncPartyPaymentStatementLinks(
      conn,
      id,
      linkedStatementIds,
      previousLinked,
    );

    if (linkedStatementIds.length) {
      try {
        await syncPartyPaymentInHistoryFromStatements(conn, id, {
          createdBy: payload.username,
        });
      } catch (histErr) {
        console.error("[party-payments] in history:", histErr);
      }
    }

    if (!result.affectedRows) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[party-payments] PUT:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const conn = await getDbConnection();
    await ensurePartyPaymentsTable(conn);

    await unlinkAllStatementsForPartyPayment(conn, id);

    const [result] = await conn.execute("DELETE FROM party_payments WHERE id = ?", [
      id,
    ]);
    if (!result.affectedRows) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[party-payments] DELETE:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
