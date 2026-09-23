/**
 * Expand customers_followup.notes from VARCHAR(255) to TEXT so long remarks are not truncated.
 */
export async function ensureCustomersFollowupNotesText(conn) {
  try {
    const [rows] = await conn.execute(
      `SELECT DATA_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'customers_followup'
         AND COLUMN_NAME = 'notes'
       LIMIT 1`,
    );

    if (!rows.length) return false;

    const dataType = String(rows[0].DATA_TYPE || "").toLowerCase();
    if (dataType === "text" || dataType === "mediumtext" || dataType === "longtext") {
      return true;
    }

    await conn.execute(
      `ALTER TABLE customers_followup MODIFY COLUMN notes TEXT NULL`,
    );
    return true;
  } catch (e) {
    console.error(
      "ensureCustomersFollowupNotesText failed:",
      e?.code,
      e?.message,
    );
    return false;
  }
}
