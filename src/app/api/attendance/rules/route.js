// /api/attendance/rules.js
import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn = await getDbConnection();
  const [rows] = await conn.query("SELECT * FROM attendance_rules ORDER BY start_time ASC");
      // await conn.end();
  return new Response(JSON.stringify(rows));
}
