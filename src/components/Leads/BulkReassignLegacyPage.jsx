import { getSessionPayload } from "@/lib/auth";
import BulkReassignTable from "@/app/admin-dashboard/bulk-reassign/BulkReassignTable";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "DIRECTOR", "SALES", "SALES CUM BACKOFFICE"];

export default async function BulkReassignLegacyPage() {
  const payload = await getSessionPayload();

  if (!payload) {
    return <p className="p-4 text-red-600">Unauthorized</p>;
  }

  const role = String(payload.role || "").toUpperCase();
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-4xl rounded-xl bg-white p-8 shadow-xl">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-700">You do not have permission to perform bulk lead reassignment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Bulk Lead Reassignment</h1>
          <p className="mt-2 text-gray-600">
            Filter and select multiple leads to reassign them to a different employee
          </p>
        </div>

        <BulkReassignTable />
      </div>
    </div>
  );
}