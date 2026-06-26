import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";
import BacklinksTable from "@/components/backlinks/BacklinksTable";
import UserBacklinksTable from "@/components/backlinks/UserBacklinksTable";

export default async function UserBacklinksPage() {
  const payload = await getSessionPayload();
  const role = payload?.role || "";
  const roleKey = normalizeRoleKey(role);
  const isEA = roleKey === "EA";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {isEA ? <BacklinksTable /> : <UserBacklinksTable />}
      </div>
    </div>
  );
}
