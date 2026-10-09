/**
 * Fixes invoice_items inserts failing with ER_DUP_ENTRY on PRIMARY key `0`
 * (missing AUTO_INCREMENT, stale counter, or legacy rows with id = 0).
 */
export async function ensureInvoiceItemsInsertReady(conn) {
  const [[{ zeroCount }]] = await conn.execute(
    `SELECT COUNT(*) AS zeroCount FROM invoice_items WHERE id = 0`,
  );
  if (Number(zeroCount) > 0) {
    const [[{ maxId }]] = await conn.execute(
      `SELECT COALESCE(MAX(id), 0) AS maxId FROM invoice_items`,
    );
    let nextId = Number(maxId) + 1;
    const [zeroRows] = await conn.execute(
      `SELECT invoice_id FROM invoice_items WHERE id = 0`,
    );
    for (const row of zeroRows) {
      await conn.execute(
        `UPDATE invoice_items SET id = ? WHERE id = 0 AND invoice_id = ? LIMIT 1`,
        [nextId, row.invoice_id],
      );
      nextId += 1;
    }
  }

  const [colInfo] = await conn.execute(
    `SHOW COLUMNS FROM invoice_items WHERE Field = 'id'`,
  );
  const extra = String(colInfo[0]?.Extra || "").toLowerCase();
  if (!extra.includes("auto_increment")) {
    await conn.execute(
      `ALTER TABLE invoice_items MODIFY COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT`,
    );
  }

  const [[{ maxId: maxAfter }]] = await conn.execute(
    `SELECT COALESCE(MAX(id), 0) AS maxId FROM invoice_items`,
  );
  const nextAuto = Math.max(Number(maxAfter) + 1, 1);
  await conn.execute(`ALTER TABLE invoice_items AUTO_INCREMENT = ${nextAuto}`);
}
