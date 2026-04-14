/**
 * Idempotent: add candidates.expected_salary after current_salary
 * Run: node scripts/migrate-candidates-expected-salary.js
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
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'candidates' AND COLUMN_NAME = 'expected_salary'"
  );
  if (cols.length) {
    console.log("Already exists: candidates.expected_salary");
    await c.end();
    return;
  }
  await c.execute(
    "ALTER TABLE candidates ADD COLUMN expected_salary VARCHAR(255) NULL DEFAULT NULL AFTER current_salary"
  );
  console.log("OK: added candidates.expected_salary");
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
