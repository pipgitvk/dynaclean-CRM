/**
 * Creates registered_spares table (idempotent).
 * Run from project root: npm run migrate:registered-spares
 * Requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env.local or .env
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

const CREATE_SQL = fs.readFileSync(
  path.join(process.cwd(), "migrations/create_registered_spares_table.sql"),
  "utf8"
);

(async () => {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error(
      "Missing DB_HOST, DB_USER, or DB_NAME. Add them to .env.local in the project root."
    );
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD ?? "",
    database: DB_NAME,
  });

  await conn.query(CREATE_SQL.trim());
  await conn.end();
  console.log("Done. Table registered_spares is ready.");
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});