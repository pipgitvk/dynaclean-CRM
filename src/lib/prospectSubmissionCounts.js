import { ensureProspectSubmissionsTable } from "@/lib/ensureProspectSubmissionsTable";

export async function getPendingProspectSubmissionsCount(conn) {
  await ensureProspectSubmissionsTable();
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS cnt
     FROM prospect_submissions
     WHERE LOWER(TRIM(COALESCE(status, ''))) = 'pending'`,
  );
  return Number(rows[0]?.cnt ?? 0);
}
