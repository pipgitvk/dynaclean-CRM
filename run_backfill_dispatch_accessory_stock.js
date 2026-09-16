require("dotenv").config();
const mysql = require("mysql2/promise");

function parseSpareNumber(name) {
  const m = String(name || "").match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

function normalizeName(name) {
  return String(name || "")
    .replace(/\([^)]*\)\s*$/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function resolveSpareId(conn, pa, productCode) {
  if (pa.spare_id) return pa.spare_id;

  const num = parseSpareNumber(pa.accessory_name);
  if (num) {
    const [r] = await conn.execute(
      `SELECT id FROM spare_list WHERE CAST(spare_number AS CHAR)=? OR CAST(id AS CHAR)=? LIMIT 1`,
      [num, num],
    );
    if (r.length) return r[0].id;
  }

  const code = pa.product_code || productCode;
  if (code) {
    const [candidates] = await conn.execute(
      `SELECT id, item_name FROM spare_list WHERE LOWER(item_name) LIKE ?`,
      [`%${String(code).toLowerCase()}%`],
    );
    const keywords = normalizeName(pa.accessory_name)
      .split(" ")
      .filter((w) => w.length > 1 && !["with", "complete", "pc", "set", "pipe", "hose"].includes(w));
    let bestId = null;
    let bestScore = 0;
    for (const c of candidates) {
      const sn = c.item_name.toLowerCase();
      let score = keywords.filter((k) => sn.includes(k)).length;
      if (keywords[0] && sn.trim().startsWith(keywords[0])) score += 2;
      if (score > bestScore) {
        bestScore = score;
        bestId = c.id;
      }
    }
    if (bestId) return bestId;
  }

  const [byName] = await conn.execute(
    `SELECT id FROM spare_list WHERE LOWER(TRIM(item_name)) = ? LIMIT 1`,
    [normalizeName(pa.accessory_name)],
  );
  return byName.length ? byName[0].id : null;
}

async function deductAccessories(conn, row, productCode, quoteMeta) {
  const checked = JSON.parse(row.accessories_checklist);
  const godown = row.godown;
  const loc = godown === "Delhi - Mundka" ? "Delhi" : "South";
  const locLower = godown === "Delhi - Mundka" ? "delhi" : "south";
  const deducted = [];

  for (const item of checked) {
    const [paRows] = await conn.execute(
      `SELECT id, spare_id, accessory_name, product_code, qty, package_status FROM product_accessories WHERE id=?`,
      [item.id],
    );
    if (!paRows.length || paRows[0].package_status === "added") continue;

    const pa = paRows[0];
    const qty = Number(pa.qty) || 1;
    const spareId = await resolveSpareId(conn, pa, productCode);
    if (!spareId) {
      console.warn(`  skip: ${pa.accessory_name} (no spare)`);
      continue;
    }

    const [summary] = await conn.execute(
      `SELECT total_quantity, ${loc} AS loc_stock, Delhi, South FROM stock_summary WHERE spare_id=?`,
      [spareId],
    );
    const totalDB = summary.length ? Number(summary[0].total_quantity ?? 0) : 0;
    const locationDB = summary.length ? Number(summary[0].loc_stock ?? 0) : 0;

    if (locationDB < qty) {
      throw new Error(`${pa.accessory_name}: need ${qty}, have ${locationDB}`);
    }

    const newLoc = locationDB - qty;
    const totalD = Math.max(totalDB - qty, 0);
    const delhiD = locLower === "delhi" ? newLoc : Number(summary[0]?.Delhi ?? 0);
    const southD = locLower === "south" ? newLoc : Number(summary[0]?.South ?? 0);

    await conn.execute(
      `INSERT INTO stock_list (spare_id, quantity, note, location, stock_status, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south, Delhi, South)
       VALUES (?, ?, ?, 'Dispatch', 'OUT', ?, ?, ?, ?, 'backfill', ?, ?, ?, ?, ?, ?)`,
      [
        spareId,
        qty,
        `Dispatch accessory: ${pa.accessory_name} (dispatch row #${row.id})`,
        quoteMeta.company_name,
        quoteMeta.company_address,
        row.quote_number,
        row.order_id,
        godown,
        totalD,
        delhiD,
        southD,
        delhiD,
        southD,
      ],
    );

    await conn.execute(
      `UPDATE stock_summary SET last_updated_quantity=?, total_quantity=?, last_status='OUT', updated_at=NOW(), ${loc}=? WHERE spare_id=?`,
      [qty, totalD, newLoc, spareId],
    );

    deducted.push({ name: pa.accessory_name, spare_id: spareId, qty });
  }

  return deducted;
}

async function ensureColumn(conn) {
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dispatch' AND COLUMN_NAME='accessories_stock_deducted'`,
  );
  if (!cols.length) {
    await conn.execute(
      `ALTER TABLE dispatch ADD COLUMN accessories_stock_deducted TINYINT(1) NOT NULL DEFAULT 0 AFTER stock_deducted`,
    );
  }
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await ensureColumn(conn);

  const [pending] = await conn.execute(
    `SELECT d.*, n.order_id FROM dispatch d LEFT JOIN neworder n ON n.quote_number=d.quote_number
     WHERE d.stock_deducted=1 AND IFNULL(d.accessories_stock_deducted,0)=0
     AND d.accessories_checklist IS NOT NULL AND TRIM(d.accessories_checklist) NOT IN ('','[]')`,
  );

  console.log(`Pending rows: ${pending.length}`);

  for (const row of pending) {
    let productCode = row.item_code;
    const [pc] = await conn.execute(
      `SELECT item_code FROM products_list WHERE item_code=? OR item_name=? LIMIT 1`,
      [productCode, productCode],
    );
    if (pc.length) productCode = pc[0].item_code;

    const [qm] = await conn.execute(
      `SELECT company_name, company_address FROM quotations_records WHERE quote_number=? LIMIT 1`,
      [row.quote_number],
    );

    try {
      const deducted = await deductAccessories(conn, row, productCode, qm[0] || {});
      await conn.execute(
        `UPDATE dispatch SET accessories_stock_deducted=1, updated_at=NOW() WHERE id=?`,
        [row.id],
      );
      console.log(`✓ dispatch #${row.id}`, deducted);
    } catch (e) {
      console.error(`✗ dispatch #${row.id}`, e.message);
    }
  }

  const [ss] = await conn.execute(
    `SELECT total_quantity, Delhi FROM stock_summary WHERE spare_id=158`,
  );
  console.log("Exide stock now:", ss[0]);

  await conn.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
