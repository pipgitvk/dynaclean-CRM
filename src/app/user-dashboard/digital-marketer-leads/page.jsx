import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";
import { canAccessDigitalMarketerLeadsModule } from "@/lib/digitalMarketerLeadsAuth";
import DigitalMarketerLeadsClient from "./DigitalMarketerLeadsClient";

export const dynamic = "force-dynamic";

export default async function DigitalMarketerLeadsPage() {
  const payload = await getSessionPayload();

  if (!payload) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8">
          <p className="text-gray-800">Please sign in to continue.</p>
        </div>
      </div>
    );
  }

  const role = payload.role ?? payload.userRole;
  if (!canAccessDigitalMarketerLeadsModule(role)) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access denied</h1>
          <p className="text-gray-700">
            This module is only available to Super Admin, Admin, and Digital
            Marketer roles.
          </p>
        </div>
      </div>
    );
  }

  const viewerRole = normalizeRoleKey(role);

  return <DigitalMarketerLeadsClient viewerRole={viewerRole} />;
}
