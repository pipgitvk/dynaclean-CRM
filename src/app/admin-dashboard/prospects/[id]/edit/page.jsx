import Link from "next/link";
import { notFound } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import { ensureProspectsTable } from "@/lib/ensureProspectsTable";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessProspectsRole,
  isProspectsAdminRole,
} from "@/lib/prospectAccess";
import EditProspectFormClient from "./EditProspectFormClient";

export const dynamic = "force-dynamic";

const errorMessages = {
  required: "Customer ID, model, and valid quantity are required.",
  qty: "Quantity must be at least 1.",
  unauthorized: "You are not allowed to edit this prospect.",
  forbidden: "You can only edit prospects you created.",
  locked: "This prospect is already submitted and cannot be changed.",
  commitment_past:
    "Commitment date cannot be before today (India time). Pick today or a future date.",
  final_deadline:
    "Final submit window has closed for this commitment date (last day of the previous month, IST). Update commitment to a future month or contact admin.",
};

const inputClass =
  "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

export default async function EditProspectPage({ params, searchParams }) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessProspectsRole(payload.role)) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        Unauthorized. Only allowed roles can edit prospects.
      </div>
    );
  }

  const { id } = await params;
  const idNum = parseInt(String(id ?? "").trim(), 10);
  if (!Number.isFinite(idNum) || idNum < 1) notFound();

  await ensureProspectsTable();
  const conn = await getDbConnection();
  const [data] = await conn.execute(
    `SELECT id, customer_id, model, qty, amount, commitment_date, notes, created_by, finalized_at
     FROM prospects WHERE id = ?`,
    [idNum],
  );
  const row = data?.[0];
  if (!row) notFound();

  const admin = isProspectsAdminRole(payload.role);
  const user = String(payload.username ?? "").trim();
  if (!admin) {
    if (!user || !row.created_by || String(row.created_by) !== user) {
      notFound();
    }
  }

  const resolved = await searchParams;
  const errKey = resolved?.error ? String(resolved.error) : "";
  const errorText = errorMessages[errKey] || null;

  const finalizedAt =
    row.finalized_at == null
      ? null
      : row.finalized_at instanceof Date
        ? row.finalized_at.toISOString()
        : String(row.finalized_at);

  const serializableRow = {
    customer_id: row.customer_id,
    model: row.model,
    qty: row.qty,
    amount: row.amount != null ? String(row.amount) : "0",
    commitment_date:
      row.commitment_date == null
        ? null
        : row.commitment_date instanceof Date
          ? row.commitment_date.toISOString().slice(0, 10)
          : String(row.commitment_date).slice(0, 10),
    notes: row.notes != null ? String(row.notes) : "",
  };

  function formatSubmittedAt(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-200 dark:bg-white">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-900">
          {finalizedAt ? "Prospect (submitted)" : "Edit prospect"}
        </h1>
        <Link
          href="/admin-dashboard/prospects"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      {errorText ? (
        <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorText}
        </div>
      ) : null}

      {finalizedAt ? (
        <>
          <div className="mb-6 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            This prospect has been submitted. It can no longer be edited.
            {formatSubmittedAt(finalizedAt) ? (
              <span className="mt-1 block text-xs text-emerald-800/90">
                Submitted: {formatSubmittedAt(finalizedAt)}
              </span>
            ) : null}
          </div>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium text-slate-600">Customer ID</dt>
              <dd className="mt-1 text-slate-900">{serializableRow.customer_id}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Model</dt>
              <dd className="mt-1 text-slate-900">{serializableRow.model}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Qty</dt>
              <dd className="mt-1 text-slate-900">{serializableRow.qty}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Total amount</dt>
              <dd className="mt-1 text-slate-900">{serializableRow.amount}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Commitment date</dt>
              <dd className="mt-1 text-slate-900">
                {serializableRow.commitment_date ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-900">
                {serializableRow.notes || "—"}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <EditProspectFormClient
            prospectId={idNum}
            row={serializableRow}
            inputClass={inputClass}
          />
        </>
      )}
    </div>
  );
}
