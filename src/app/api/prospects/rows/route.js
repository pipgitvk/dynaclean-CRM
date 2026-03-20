import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureProspectsTable } from "@/lib/ensureProspectsTable";
import {
  parseCustomerIdsParam,
  parseProspectsAdminFiltersFromUrlSearchParams,
} from "@/lib/prospectFilterUtils";
import {
  canAccessProspectsRole,
  isProspectsAdminRole,
} from "@/lib/prospectAccess";
import { buildProspectsListWhereClause } from "@/lib/prospectListQuery";
import {
  enrichProspectRowsWithPaymentStatus,
  commitmentValueToYmd,
} from "@/lib/orderPaymentTarget";

function mapRows(data) {
  return (data || []).map((row) => ({
    ...row,
    customer_name:
      row.customer_name != null && String(row.customer_name).trim() !== ""
        ? String(row.customer_name).trim()
        : null,
    status:
      row.status != null && String(row.status).trim() !== ""
        ? String(row.status).trim()
        : "open",
    quote_number:
      row.quote_number != null && String(row.quote_number).trim() !== ""
        ? String(row.quote_number).trim()
        : null,
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

    const adminFilters = isProspectsAdminRole(payload.role)
      ? parseProspectsAdminFiltersFromUrlSearchParams(searchParams)
      : null;

    const { whereSql, params } = buildProspectsListWhereClause({
      customerIds,
      like,
      role: payload.role,
      username: payload.username,
      adminFilters,
    });

    let query = `
      SELECT p.id, p.customer_id, p.order_id, p.quote_number, p.status, p.model, p.qty, p.amount,
             p.commitment_date, p.notes, p.created_by, p.finalized_at,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''),
               NULLIF(TRIM(c.company), '')
             ) AS customer_name
      FROM prospects p
      LEFT JOIN customers c ON TRIM(c.customer_id) = TRIM(p.customer_id)
    `;
    query += whereSql;
    query += ` ORDER BY p.commitment_date IS NULL, p.commitment_date ASC, p.updated_at DESC`;

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
