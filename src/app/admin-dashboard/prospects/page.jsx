import { getDbConnection } from "@/lib/db";
import { ensureProspectsTable } from "@/lib/ensureProspectsTable";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessProspectsRole,
  isProspectsAdminRole,
} from "@/lib/prospectAccess";
import ProspectsListCard from "./ProspectsListCard";
import { parseCustomerIdsParam } from "@/lib/prospectFilterUtils";
import { buildProspectsListWhereClause } from "@/lib/prospectListQuery";
import {
  enrichProspectRowsWithPaymentStatus,
  commitmentValueToYmd,
} from "@/lib/orderPaymentTarget";

export const dynamic = "force-dynamic";

export default async function ProspectsPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessProspectsRole(payload.role)) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
        Unauthorized. Prospects is for super admin, admin, or sales roles.
      </div>
    );
  }

  const resolved = await searchParams;
  const searchRaw = String(resolved?.search ?? "").trim();
  const customerIds = parseCustomerIdsParam(
    String(resolved?.customers ?? ""),
  );
  const like = searchRaw ? `%${searchRaw}%` : null;

  let rows = [];
  let loadError = null;

  try {
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
    rows = await enrichProspectRowsWithPaymentStatus(conn, data || []);
  } catch (e) {
    const code = e?.code || e?.errno;
    if (code === "ER_NO_SUCH_TABLE" || code === 1146) {
      loadError =
        "Prospects table is missing. Run the SQL in admin-dashboard/prospects/migration_create_prospects.sql on your database.";
    } else {
      loadError = e?.message || "Could not load prospects.";
    }
  }

  const serializableRows = (rows || []).map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    order_id:
      row.order_id != null && String(row.order_id).trim() !== ""
        ? String(row.order_id).trim()
        : null,
    model: row.model,
    qty: row.qty,
    amount: row.amount != null ? String(row.amount) : null,
    commitment_date: commitmentValueToYmd(row.commitment_date),
    notes: row.notes != null ? String(row.notes) : null,
    created_by: row.created_by != null ? String(row.created_by) : null,
    finalized_at:
      row.finalized_at == null
        ? null
        : row.finalized_at instanceof Date
          ? row.finalized_at.toISOString()
          : String(row.finalized_at),
    order_payment_target: row.order_payment_target ?? null,
  }));

  const viewerUsername = String(payload.username ?? "").trim();
  const viewerIsAdmin = isProspectsAdminRole(payload.role);

  return (
    <div className="mx-auto w-full max-w-screen-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-200 dark:bg-white">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">
        Prospects
      </h1>

      <ProspectsListCard
        initialRows={serializableRows}
        initialSearch={searchRaw}
        initialCustomerIds={customerIds}
        loadError={loadError}
        viewerUsername={viewerUsername}
        viewerIsAdmin={viewerIsAdmin}
      />
    </div>
  );
}
