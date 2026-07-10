import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";
import { redirect } from "next/navigation";
import BacklinksExcelTable from "@/components/digital-market-excel/BacklinksExcelTable";

export default async function IsmeExcelPage() {
  const payload = await getSessionPayload();
  const role = payload?.role || "";
  const roleKey = normalizeRoleKey(role);

  // Only SuperAdmin and Digital Marketer can access
  if (roleKey !== "SUPERADMIN" && roleKey !== "DIGITAL MARKETER") {
    redirect("/user-dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <BacklinksExcelTable />
      </div>
    </div>
  );
}
