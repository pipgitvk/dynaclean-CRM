/**
 * Idempotent: candidates_followups — drop status_before, rename status_after -> `status`
 * Run: node scripts/migrate-candidates-followups-status-column.js
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
    return;
  }
}

loadEnv();

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME,
  });
  const [cols] = await c.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'candidates_followups'"
  );
  const names = new Set(cols.map((r) => r.COLUMN_NAME));
  if (names.has("status") && !names.has("status_after")) {
    console.log("Already migrated: candidates_followups has `status`.");
    await c.end();
    return;
  }
  if (!names.has("status_after")) {
    console.error("candidates_followups: missing status_after. Columns:", [...names].join(", "));
    process.exit(1);
  }
  if (names.has("status_before")) {
    await c.execute(
      "ALTER TABLE candidates_followups DROP COLUMN status_before, CHANGE COLUMN status_after `status` VARCHAR(80) NOT NULL COMMENT 'Status at this event'"
    );
    console.log("OK: dropped status_before, renamed status_after -> status");
  } else {
    await c.execute(
      "ALTER TABLE candidates_followups CHANGE COLUMN status_after `status` VARCHAR(80) NOT NULL COMMENT 'Status at this event'"
    );
    console.log("OK: renamed status_after -> status (status_before was already absent)");
  }
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
