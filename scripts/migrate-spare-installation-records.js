/**
 * Creates spare_installation_records table.
 * Run: npm run migrate:spare-installation-records
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

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
      if (process.env[k] === undefined) process.env[k] = v.replace(/^['"]|['"]$/g, "");
    }
    return;
  }
}

loadEnv();

(async () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "migrations/create_spare_installation_records_table.sql"),
    "utf8",
  );
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME,
  });
  await conn.query(sql.trim());
  await conn.end();
  console.log("Done. Table spare_installation_records is ready.");
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});