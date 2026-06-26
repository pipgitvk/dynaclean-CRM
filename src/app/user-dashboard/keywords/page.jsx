import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";
import KeywordsTable from "@/components/keywords/KeywordsTable";
import UserKeywordsTable from "@/components/keywords/UserKeywordsTable";

export default async function KeywordsPage() {
  const payload = await getSessionPayload();
  const role = payload?.role || "";
  const roleKey = normalizeRoleKey(role);
  const isEA = roleKey === "EA";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {isEA ? <KeywordsTable /> : <UserKeywordsTable />}
      </div>
    </div>
  );
}
