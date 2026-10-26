import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePartyPaymentsTable } from "@/lib/ensurePartyPaymentsTable";
import {
  derivePartyPaymentStatus,
  normalizePartyPaymentAmounts,
} from "@/lib/partyPaymentsCompute";
import {
  parsePartyPaymentLinkedStatementIds,
  sumLinkedPartyPaymentStatementAmounts,
  syncPartyPaymentStatementLinks,
} from "@/lib/partyPaymentStatementLink";
import {
  reconcilePartyPaymentTotalsFromHistory,
  syncPartyPaymentInHistoryFromStatements,
} from "@/lib/partyPaymentHistory";

const SELECT_FIELDS = `
  id, customer_id, name, company_name, phone, payment_date,
  amount_in, amount_out, balance, status,
  linked_statement_ids, linked_order_id, order_id, invoice_number,
  created_by, created_at, updated_at
`;

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

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = String(searchParams.get("search") || "").trim();
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("limit") || "200", 10) || 200),
    );

    const conn = await getDbConnection();
    await ensurePartyPaymentsTable(conn);

    let sql = `SELECT ${SELECT_FIELDS} FROM party_payments`;
    const params = [];
    if (search) {
      const like = `%${search}%`;
      const [custRows] = await conn.execute(
        `SELECT customer_id FROM customers
         WHERE CAST(customer_id AS CHAR) LIKE ?
            OR CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) LIKE ?
            OR first_name LIKE ?
            OR last_name LIKE ?
            OR company LIKE ?
            OR phone LIKE ?
            OR email LIKE ?
         LIMIT 100`,
        [like, like, like, like, like, like, like],
      );
      const customerIds = (custRows || [])
        .map((r) => String(r.customer_id ?? "").trim())
        .filter(Boolean);

      const idPlaceholders = customerIds.map(() => "?").join(", ");
      const customerIdInClause = customerIds.length
        ? ` OR customer_id IN (${idPlaceholders})`
        : "";

      sql += ` WHERE (
        customer_id LIKE ? OR name LIKE ? OR company_name LIKE ? OR phone LIKE ?
        ${customerIdInClause}
      )`;
      params.push(like, like, like, like, ...customerIds);
    }
    sql += ` ORDER BY payment_date DESC, id DESC LIMIT ${limit}`;

    const [rows] = await conn.execute(sql, params);

    for (const row of rows || []) {
      try {
        await reconcilePartyPaymentTotalsFromHistory(conn, row.id);
      } catch (reconcileErr) {
        console.error("[party-payments] reconcile out:", reconcileErr);
      }
    }

    const [rowsFresh] = await conn.execute(sql, params);

    const data = (rowsFresh || []).map((row) => ({
      ...row,
      status:
        row.status ||
        derivePartyPaymentStatus(row.amount_in, row.amount_out),
    }));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[party-payments] GET:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (linkedStatementIds.length) {
      const summed = await sumLinkedPartyPaymentStatementAmounts(
        conn,
        linkedStatementIds,
      );
      amounts = normalizePartyPaymentAmounts({
        ...body,
        amount_in: summed.creditTotal,
        amount_out: summed.debitTotal || amounts.amount_out,
      });
      if (!paymentDate && summed.latestDate) paymentDate = summed.latestDate;
    }

    const [result] = await conn.execute(
      `INSERT INTO party_payments (
        customer_id, name, company_name, phone, payment_date,
        amount_in, amount_out, balance, status,
        linked_statement_ids, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        payload.username,
      ],
    );

    const newId = result.insertId;
    if (linkedStatementIds.length) {
      await syncPartyPaymentStatementLinks(conn, newId, linkedStatementIds, []);
      try {
        await syncPartyPaymentInHistoryFromStatements(conn, newId, {
          createdBy: payload.username,
        });
      } catch (histErr) {
        console.error("[party-payments] in history:", histErr);
      }
    }

    return NextResponse.json({ success: true, id: newId });
  } catch (err) {
    console.error("[party-payments] POST:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
