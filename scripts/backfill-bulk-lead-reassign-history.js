/**
 * Backfill bulk_lead_reassign_history from customers_followup.
 * Run: node scripts/backfill-bulk-lead-reassign-history.js
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dns = require("dns").promises;
const { pathToFileURL } = require("url");

function loadEnvFile() {
  const root = process.cwd();
  for (const name of [".env.local", ".env"]) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
    return;
  }
}

async function main() {
  loadEnvFile();
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error("Missing DB_HOST, DB_USER, or DB_NAME in .env");
    process.exit(1);
  }

  let host = DB_HOST;
  try {
    const { address } = await dns.lookup(DB_HOST, { family: 4 });
    host = address;
  } catch {
    /* use host as-is */
  }

  const conn = await mysql.createConnection({
    host,
    user: DB_USER,
    password: DB_PASSWORD || "",
    database: DB_NAME,
    dateStrings: true,
  });

  let backfillBulkLeadReassignHistory;
  let ensureBulkLeadReassignHistoryTable;
  let parseReassignNote;
  try {
    const libPath = path.join(__dirname, "..", "src", "lib", "bulkLeadReassignHistory.js");
    const mod = await import(pathToFileURL(libPath).href);
    backfillBulkLeadReassignHistory = mod.backfillBulkLeadReassignHistory;
    ensureBulkLeadReassignHistoryTable = mod.ensureBulkLeadReassignHistoryTable;
    parseReassignNote = mod.parseReassignNote;
  } catch (err) {
    console.error("Could not load bulkLeadReassignHistory.js:", err.message);
    process.exit(1);
  }

  await ensureBulkLeadReassignHistoryTable(conn);

  const [[{ followupCount }]] = await conn.execute(
    `SELECT COUNT(*) AS followupCount FROM customers_followup cf
     WHERE LOWER(TRIM(COALESCE(cf.comm_mode, ''))) = 'system'
       AND cf.notes LIKE '%e-assigned lead from%'`,
  );
  console.log("System reassign follow-up rows (approx):", followupCount);

  const [sample] = await conn.execute(
    `SELECT notes FROM customers_followup
     WHERE notes LIKE 'Re-assigned lead from%' LIMIT 3`,
  );
  for (const row of sample) {
    const parsed = parseReassignNote(row.notes);
    console.log("Sample parse:", parsed ? "OK" : "FAIL", String(row.notes).slice(0, 80));
  }

  const result = await backfillBulkLeadReassignHistory(conn, { resetBackfill: true });
  console.log("Backfill result:", result);

  const [sample708941] = await conn.execute(
    `SELECT customer_id, assigned_to, valid_from, valid_to
     FROM bulk_lead_reassign_history WHERE customer_id = 708941 ORDER BY valid_from LIMIT 3`,
  );
  console.log("Sample 708941:", sample708941);

  const [[{ total }]] = await conn.execute(
    "SELECT COUNT(*) AS total FROM bulk_lead_reassign_history",
  );
  console.log("Rows in bulk_lead_reassign_history:", total);

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});