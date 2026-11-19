import { getSessionPayload } from "@/lib/auth";
import LeadsManageQuickBulkClient from "@/components/Leads/LeadsManageQuickBulkClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "DIRECTOR", "SALES", "SALES CUM BACKOFFICE"];

export default async function LeadsManageQuickBulkPage({ dashboardBase = "admin-dashboard" }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return <p className="p-4 text-red-600">Unauthorized</p>;
  }

  const role = String(payload.role || "").toUpperCase();
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 sm:p-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-rose-600">Access Denied</h1>
          <p className="mt-2 text-slate-600">You do not have permission to bulk reassign leads.</p>
        </div>
      </div>
    );
  }

  return <LeadsManageQuickBulkClient dashboardBase={dashboardBase} />;
}