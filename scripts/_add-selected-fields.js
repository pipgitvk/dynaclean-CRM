const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), name);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
    return;
  }
}

loadEnv();
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME,
  });

  const steps = [
    ["selected_resume", "ALTER TABLE hr_hiring_entries ADD COLUMN selected_resume VARCHAR(500) NULL DEFAULT NULL AFTER probation_months"],
    ["mgmt_interview_score", "ALTER TABLE hr_hiring_entries ADD COLUMN mgmt_interview_score TINYINT UNSIGNED NULL DEFAULT NULL AFTER selected_resume"],
  ];

  for (const [col, sql] of steps) {
    try {
      await conn.query(sql);
      console.log(`  Added: ${col}`);
    } catch (e) {
      if (e.errno === 1060) console.log(`  Already exists, skipped: ${col}`);
      else { await conn.end(); console.error(e.message); process.exit(1); }
    }
  }

  await conn.end();
  console.log("Done.");
})().catch((e) => { console.error(e.message); process.exit(1); });
