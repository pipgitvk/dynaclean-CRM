import { getDbConnection } from "@/lib/db";
import { checkLeadDistributionAccess } from "@/lib/checkLeadDistributionAccess";

export async function GET() {
  const access = await checkLeadDistributionAccess();
  if (!access.allowed) {
    return access.forbidden;
  }

  const conn =await getDbConnection();

  const [rows] = await conn.execute("SELECT * FROM lead_distribution ORDER BY priority ASC");

      // await conn.end();
  return Response.json(rows);
}