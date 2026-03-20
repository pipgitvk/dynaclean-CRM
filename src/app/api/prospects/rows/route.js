import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureProspectsTable } from "@/lib/ensureProspectsTable";
import { parseCustomerIdsParam } from "@/lib/prospectFilterUtils";
import { canAccessProspectsRole } from "@/lib/prospectAccess";
import { buildProspectsListWhereClause } from "@/lib/prospectListQuery";
import {
  enrichProspectRowsWithPaymentStatus,
  commitmentValueToYmd,
} from "@/lib/orderPaymentTarget";

function mapRows(data) {
  return (data || []).map((row) => ({
    ...row,
    order_id:
      row.order_id != null && String(row.order_id).trim() !== ""
        ? String(row.order_id).trim()
        : null,
    amount: row.amount != null ? String(row.amount) : null,
    notes: row.notes != null ? String(row.notes) : null,
    created_by: row.created_by != null ? String(row.created_by) : null,
    commitment_date: commitmentValueToYmd(row.commitment_date),
    finalized_at:
      row.finalized_at == null
        ? null
        : row.finalized_at instanceof Date
          ? row.finalized_at.toISOString()
          : String(row.finalized_at),
  }));
}

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !canAccessProspectsRole(payload.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerIds = parseCustomerIdsParam(
      String(searchParams.get("customers") ?? ""),
    );
    const searchRaw = String(searchParams.get("search") ?? "").trim();
    const like = searchRaw ? `%${searchRaw}%` : null;

    await ensureProspectsTable();
    const conn = await getDbConnection();

    const { whereSql, params } = buildProspectsListWhereClause({
      customerIds,
      like,
      role: payload.role,
      username: payload.username,
    });

    let query = `
      SELECT id, customer_id, order_id, model, qty, amount, commitment_date, notes, created_by, finalized_at
      FROM prospects
    `;
    query += whereSql;
    query += ` ORDER BY commitment_date IS NULL, commitment_date ASC, updated_at DESC`;

    const [data] = await conn.execute(query, params);
    const baseRows = mapRows(data);
    const rows = await enrichProspectRowsWithPaymentStatus(conn, baseRows);

    return NextResponse.json({ success: true, rows });
  } catch (e) {
    console.error("prospects rows API:", e);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
