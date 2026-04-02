import Link from "next/link";
import { getSessionPayload } from "@/lib/auth";
import { canAccessProspectsRole } from "@/lib/prospectAccess";
import ManualProspectFormClient from "./ManualProspectFormClient";

export const dynamic = "force-dynamic";

const errorMessages = {
  required: "Customer ID and model are required.",
  qty: "Quantity must be at least 1.",
  unauthorized: "You are not allowed to add prospects.",
  commitment_past:
    "Commitment date cannot be before today (India time). Use today or a future date.",
  forbidden_customer:
    "You can only add prospects for customers assigned to you (your leads).",
};

const inputClass =
  "h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

export default async function AddManualProspectPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessProspectsRole(payload.role)) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        Unauthorized. Only allowed roles can add prospects.
      </div>
    );
  }

  const resolved = await searchParams;
  const errKey = resolved?.error ? String(resolved.error) : "";
  const errorText = errorMessages[errKey] || null;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-200 dark:bg-white">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-900">
          Add prospect (manual)
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

      <ManualProspectFormClient inputClass={inputClass} />
    </div>
  );
}
