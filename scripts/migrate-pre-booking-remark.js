/**
 * Idempotent: pre_booking — remark columns + cancelled/postponed status enum
 * Run: npm run migrate:pre-booking-remark
 */
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  for (const n of [".env.local", ".env"]) {
    const f = path.join(process.cwd(), n);
    if (!fs.existsSync(f)) continue;
    for (const ln of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const t = ln.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
    return;
  }
}

loadEnv();

const COLUMNS = [
  {
    name: "remark_type",
    sql: `ALTER TABLE pre_booking ADD COLUMN remark_type ENUM('cancelled', 'postponed') DEFAULT NULL COMMENT 'Order cancelled or postponed'`,
  },
  {
    name: "remark_reason",
    sql: `ALTER TABLE pre_booking ADD COLUMN remark_reason TEXT DEFAULT NULL COMMENT 'Reason note for cancellation or postponement'`,
  },
  {
    name: "postponed_date",
    sql: `ALTER TABLE pre_booking ADD COLUMN postponed_date DATE DEFAULT NULL COMMENT 'New expected date when order is postponed'`,
  },
];

const STATUS_ENUM_SQL = `ALTER TABLE pre_booking MODIFY COLUMN status ENUM('pending', 'partial', 'received', 'cancelled', 'postponed') DEFAULT 'pending' COMMENT 'Pre-booking status'`;

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME,
  });

  const [cols] = await c.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pre_booking'`,
  );
  const names = new Set(cols.map((r) => r.COLUMN_NAME));

  for (const col of COLUMNS) {
    if (names.has(col.name)) {
      console.log(`Already migrated: pre_booking.${col.name} exists.`);
      continue;
    }

    await c.execute(col.sql);
    console.log(`OK: added pre_booking.${col.name}`);
  }

  try {
    await c.execute(STATUS_ENUM_SQL);
    console.log(
      "OK: updated pre_booking.status enum (pending, partial, received, cancelled, postponed)",
    );
  } catch (e) {
    console.warn("Status enum update skipped or already applied:", e.message);
  }

  await c.end();
  console.log("Migration complete: pre-booking remark fields.");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
