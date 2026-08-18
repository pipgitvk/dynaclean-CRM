/**
 * Idempotent: customers_followup — add notes_language column
 * Run: node scripts/migrate-notes-language-column.js
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

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME,
  });

  const [cols] = await c.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers_followup'"
  );
  const names = new Set(cols.map((r) => r.COLUMN_NAME));

  if (names.has("notes_language")) {
    console.log("Already migrated: customers_followup.notes_language exists.");
    await c.end();
    return;
  }

  await c.execute(
    "ALTER TABLE customers_followup ADD COLUMN notes_language VARCHAR(10) NOT NULL DEFAULT 'en' AFTER notes"
  );
  console.log("OK: added customers_followup.notes_language");
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
