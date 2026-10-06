import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getEngineerIdFromPayload } from "@/lib/thirdPartyEngineerPortalSession";
import { ensureThirdPartyEngineerColumns } from "@/lib/thirdPartyEngineerSchema";
import ThirdPartyEngineerHome from "@/components/thirdParty/ThirdPartyEngineerHome";

export const dynamic = "force-dynamic";

export default async function ThirdPartyEngineerDashboardPage() {
  const payload = await getSessionPayload();
  const engineerId = getEngineerIdFromPayload(payload);
  if (!engineerId) redirect("/login");

  const conn = await getDbConnection();
  await ensureThirdPartyEngineerColumns(conn);

  const [engRows] = await conn.execute(
    `SELECT engineer_id, name, email, mobile, status
     FROM third_party_service_engineers WHERE engineer_id = ? LIMIT 1`,
    [engineerId]
  );
  if (!engRows.length || engRows[0].status !== "active") {
    redirect("/login");
  }

  const [countRows] = await conn.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed
     FROM service_records
     WHERE third_party_engineer_id = ?
        OR (assigned_to_type = 'third_party' AND assigned_to_id = ?)`,
    [engineerId, engineerId]
  );

  const c = countRows[0] || {};
  const counts = {
    total: Number(c.total) || 0,
    pending: Number(c.pending) || 0,
    completed: Number(c.completed) || 0,
  };

  return <ThirdPartyEngineerHome engineer={engRows[0]} counts={counts} />;
}
