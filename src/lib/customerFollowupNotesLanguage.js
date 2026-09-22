import { ensureCustomerNotesLanguageColumn } from "@/lib/ensureCustomerNotesLanguageColumn";
import { mysqlBoundsForIstDateRange } from "@/lib/timezone";

export const latestFollowedDateSelectSql = `(
  SELECT cf2.followed_date
  FROM customers_followup cf2
  WHERE cf2.customer_id = c.customer_id
  ORDER BY cf2.followed_date DESC, cf2.time_stamp DESC
  LIMIT 1
) AS followed_date`;

export function appendLatestFollowedDateIstFilter({
  conditions,
  params,
  followedDateYmd,
  customerAlias = "c",
}) {
  const bounds = mysqlBoundsForIstDateRange(followedDateYmd, followedDateYmd);
  if (!bounds) return;

  conditions.push(`(
    SELECT cf2.followed_date
    FROM customers_followup cf2
    WHERE cf2.customer_id = ${customerAlias}.customer_id
    ORDER BY cf2.followed_date DESC, cf2.time_stamp DESC
    LIMIT 1
  ) BETWEEN ? AND ?`);
  params.push(bounds.start, bounds.end);
}

export const latestFollowupNotesLanguageSelectSql = `COALESCE(
  c.notes_language,
  (
    SELECT cf.notes_language
    FROM customers_followup cf
    WHERE cf.customer_id = c.customer_id
    ORDER BY cf.followed_date DESC, cf.time_stamp DESC
    LIMIT 1
  )
) AS notes_language`;

export async function updateCustomerNotesLanguage(conn, customerId, language) {
  await ensureCustomerNotesLanguageColumn(conn);
  const normalized = language ? String(language).trim().slice(0, 10) : null;
  await conn.execute(
    "UPDATE customers SET notes_language = ? WHERE customer_id = ?",
    [normalized, customerId],
  );
}

export async function getLatestFollowupNotesLanguage(conn, customerId) {
  const [rows] = await conn.execute(
    `SELECT notes_language
     FROM customers_followup
     WHERE customer_id = ?
     ORDER BY followed_date DESC, time_stamp DESC
     LIMIT 1`,
    [customerId],
  );

  const lang = rows[0]?.notes_language;
  if (lang == null || String(lang).trim() === "") return null;
  return String(lang).trim();
}

export async function updateLatestFollowupNotesLanguage(conn, customerId, language) {
  const normalized = language ? String(language).trim().slice(0, 10) : null;

  const [latest] = await conn.execute(
    `SELECT time_stamp
     FROM customers_followup
     WHERE customer_id = ?
     ORDER BY followed_date DESC, time_stamp DESC
     LIMIT 1`,
    [customerId],
  );

  if (!latest.length) return false;

  await conn.execute(
    `UPDATE customers_followup
     SET notes_language = ?
     WHERE customer_id = ? AND time_stamp = ?`,
    [normalized, customerId, latest[0].time_stamp],
  );

  return true;
}
