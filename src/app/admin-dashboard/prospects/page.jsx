import { Suspense } from "react";
import Link from "next/link";
import { getDbConnection } from "@/lib/db";
import { ensureProspectsTable } from "@/lib/ensureProspectsTable";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessProspectsRole,
  isProspectsAdminRole,
} from "@/lib/prospectAccess";
import ProspectsListCard from "./ProspectsListCard";
import {
  parseCustomerIdsParam,
  parseQuoteNumbersParam,
  parseProspectsAdminFiltersFromSearchParams,
  mergeProspectAdminCalendarDefaults,
} from "@/lib/prospectFilterUtils";
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
  const quoteNumbers = parseQuoteNumbersParam(
    String(resolved?.quote_numbers ?? ""),
  );
  const like = searchRaw ? `%${searchRaw}%` : null;

  const viewerIsAdmin = isProspectsAdminRole(payload.role);
  const adminFiltersParsed = viewerIsAdmin
    ? parseProspectsAdminFiltersFromSearchParams(resolved)
    : null;
  const adminFilters = viewerIsAdmin
    ? mergeProspectAdminCalendarDefaults(resolved, adminFiltersParsed)
    : null;

  let rows = [];
  let loadError = null;
  let prospectCreatorUsernames = [];

  try {
    await ensureProspectsTable();
    const conn = await getDbConnection();

    if (viewerIsAdmin) {
      try {
        const [cr] = await conn.execute(
          `SELECT DISTINCT TRIM(created_by) AS u
           FROM prospects
           WHERE created_by IS NOT NULL AND TRIM(created_by) <> ''
           ORDER BY u ASC`,
        );
        prospectCreatorUsernames = (cr || [])
          .map((r) => String(r.u ?? "").trim())
          .filter(Boolean);
      } catch {
        prospectCreatorUsernames = [];
      }
    }

    const { whereSql, params } = buildProspectsListWhereClause({
      customerIds,
      like,
      searchRaw: searchRaw || null,
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
      LEFT JOIN customers c ON BINARY TRIM(c.customer_id) = BINARY TRIM(p.customer_id)
    `;
    query += whereSql;
    query += ` ORDER BY p.commitment_date IS NULL, p.commitment_date ASC, p.updated_at DESC`;

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

  return (
    <div className="mx-auto w-full max-w-screen-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8 dark:border-slate-200 dark:bg-white">
      {!viewerIsAdmin && (
        <Link
          href="/user-dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
        >
          ← Back to user dashboard
        </Link>
      )}
      <h1 className="mb-4 text-xl font-semibold tracking-tight text-slate-900 sm:mb-6 sm:text-2xl">
        Prospects
      </h1>

      <Suspense
        fallback={
          <div className="rounded-[10px] border border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500">
            Loading prospects…
          </div>
        }
      >
        <ProspectsListCard
          initialRows={serializableRows}
          initialSearch={searchRaw}
          initialCustomerIds={customerIds}
          initialQuoteNumbers={quoteNumbers}
          initialAdminFilters={adminFilters}
          prospectCreatorUsernames={prospectCreatorUsernames}
          loadError={loadError}
          viewerUsername={viewerUsername}
          viewerIsAdmin={viewerIsAdmin}
        />
      </Suspense>
    </div>
  );
}
