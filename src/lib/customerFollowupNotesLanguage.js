export const latestFollowupNotesLanguageSelectSql = `(
  SELECT cf.notes_language
  FROM customers_followup cf
  WHERE cf.customer_id = c.customer_id
  ORDER BY cf.followed_date DESC, cf.time_stamp DESC
  LIMIT 1
) AS notes_language`;

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
