const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dns = require("dns").promises;

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
  let host = DB_HOST;
  try {
    const { address } = await dns.lookup(DB_HOST, { family: 4 });
    host = address;
  } catch {}

  const conn = await mysql.createConnection({
    host,
    user: DB_USER,
    password: DB_PASSWORD ?? "",
    database: DB_NAME,
  });

  const [[mfCols]] = await conn.query(
    `SHOW COLUMNS FROM machines_followup LIKE 'serial_number'`
  );
  const [[srCols]] = await conn.query(
    `SHOW COLUMNS FROM service_records LIKE 'serial_number'`
  );
  console.log("mf serial collation", mfCols.Collation, mfCols.Type);
  console.log("sr serial collation", srCols.Collation, srCols.Type);

  const [mf] = await conn.query(
    `SELECT id, serial_number, HEX(serial_number) AS hex_sn, CHAR_LENGTH(serial_number) AS len, CHAR_LENGTH(TRIM(serial_number)) AS tlen
     FROM machines_followup WHERE service_id IS NULL ORDER BY id DESC LIMIT 8`
  );
  console.log("sample mf", mf);

  const serials = mf.map((r) => r.serial_number).filter(Boolean);
  if (serials.length) {
    const [sr] = await conn.query(
      `SELECT service_id, serial_number, HEX(serial_number) AS hex_sn, CHAR_LENGTH(serial_number) AS len
       FROM service_records WHERE serial_number IN (${serials.map(() => "?").join(",")}) LIMIT 20`,
      serials
    );
    console.log("exact IN match sr", sr.length, sr.slice(0, 5));

    const [sr2] = await conn.query(
      `SELECT service_id, serial_number FROM service_records
       WHERE TRIM(serial_number) = TRIM(?) LIMIT 5`,
      [serials[0]]
    );
    console.log("trim match first serial", serials[0], sr2);

    const [sr3] = await conn.query(
      `SELECT COUNT(*) AS n FROM service_records WHERE serial_number IS NOT NULL AND serial_number != ''`
    );
    const [mf3] = await conn.query(`SELECT COUNT(*) AS n FROM machines_followup`);
    console.log("sr with serial", sr3[0].n, "mf total", mf3[0].n);
  }

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
