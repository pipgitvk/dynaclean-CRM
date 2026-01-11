import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn =await getDbConnection();

  const [rows] = await conn.execute("SELECT * FROM lead_distribution ORDER BY priority ASC");

      // await conn.end();
  return Response.json(rows);
}