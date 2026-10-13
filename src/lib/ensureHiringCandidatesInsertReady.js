/**
 * Fixes hiring inserts failing with ER_DUP_ENTRY on PRIMARY key `0`
 * (missing AUTO_INCREMENT, stale counter, or legacy rows with id = 0).
 */

async function repairZeroPrimaryIds(conn, tableName) {
  const [[{ zeroCount }]] = await conn.execute(
    `SELECT COUNT(*) AS zeroCount FROM \`${tableName}\` WHERE id = 0`
  );
  if (Number(zeroCount) === 0) return;

  const [[{ maxId }]] = await conn.execute(
    `SELECT COALESCE(MAX(id), 0) AS maxId FROM \`${tableName}\``
  );
  let nextId = Number(maxId) + 1;
  for (;;) {
    const [result] = await conn.execute(
      `UPDATE \`${tableName}\` SET id = ? WHERE id = 0 LIMIT 1`,
      [nextId]
    );
    if (!result?.affectedRows) break;
    nextId += 1;
  }
}

async function ensureIdAutoIncrement(conn, tableName) {
  const [colInfo] = await conn.execute(
    `SHOW COLUMNS FROM \`${tableName}\` WHERE Field = 'id'`
  );
  if (!colInfo?.length) return;

  const extra = String(colInfo[0]?.Extra || "").toLowerCase();
  const type = String(colInfo[0]?.Type || "").toLowerCase();
  const unsigned = type.includes("unsigned");

  if (!extra.includes("auto_increment")) {
    await conn.execute(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN id INT ${
        unsigned ? "UNSIGNED " : ""
      }NOT NULL AUTO_INCREMENT`
    );
  }

  const [[{ maxId }]] = await conn.execute(
    `SELECT COALESCE(MAX(id), 0) AS maxId FROM \`${tableName}\``
  );
  const nextAuto = Math.max(Number(maxId) + 1, 1);
  await conn.execute(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = ${nextAuto}`);
}

async function prepareTable(conn, tableName) {
  try {
    await repairZeroPrimaryIds(conn, tableName);
    await ensureIdAutoIncrement(conn, tableName);
  } catch (err) {
    if (err?.code === "ER_NO_SUCH_TABLE") return;
    throw err;
  }
}

export async function ensureHiringCandidatesInsertReady(conn) {
  await prepareTable(conn, "candidates");
  await prepareTable(conn, "candidates_followups");
}

export function isHiringDuplicatePrimaryZeroError(error) {
  const msg = `${error?.message || ""} ${error?.sqlMessage || ""}`;
  return (
    error?.code === "ER_DUP_ENTRY" &&
    (msg.includes("PRIMARY") || msg.includes("Duplicate entry '0'"))
  );
}
