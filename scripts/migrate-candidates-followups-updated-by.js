/**
 * Idempotent: candidates_followups — rename actor_username -> updated_by
 * Run: node scripts/migrate-candidates-followups-updated-by.js
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
  if (names.has("updated_by") && !names.has("actor_username")) {
    console.log("Already migrated: candidates_followups.updated_by exists.");
    await c.end();
    return;
  }
  if (!names.has("actor_username")) {
    console.error("candidates_followups: missing actor_username. Columns:", [...names].join(", "));
    process.exit(1);
  }
  await c.execute(
    "ALTER TABLE candidates_followups CHANGE COLUMN actor_username `updated_by` VARCHAR(128) NOT NULL COMMENT 'User who logged this status event'"
  );
  console.log("OK: renamed actor_username -> updated_by");
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
