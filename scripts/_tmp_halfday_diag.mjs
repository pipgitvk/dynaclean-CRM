import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  dateStrings: true,
});

const username = "Ashutosh Choudhary";
const [rows] = await conn.query(
  `SELECT DATE_FORMAT(date,'%Y-%m-%d') d,
          DATE_FORMAT(MIN(checkin_time),'%H:%i:%s') earliest_in,
          DATE_FORMAT(MAX(checkout_time),'%H:%i:%s') latest_out,
          SUM(checkout_address = 'Machine') machine_rows,
          SUM(checkout_address <> 'Machine' OR checkout_address IS NULL) other_rows
   FROM attendance_logs
   WHERE username = ? AND date >= '2026-10-01' AND date < '2026-11-01'
   GROUP BY DATE_FORMAT(date,'%Y-%m-%d')
   ORDER BY d`,
  [username]
);

const [detail] = await conn.query(
  `SELECT DATE_FORMAT(date,'%Y-%m-%d') d,
          DATE_FORMAT(checkin_time,'%H:%i:%s') cin,
          DATE_FORMAT(checkout_time,'%H:%i:%s') cout,
          LEFT(IFNULL(checkout_address,''), 16) addr
   FROM attendance_logs
   WHERE username = ? AND date >= '2026-10-01' AND date < '2026-11-01'
     AND (checkout_address IS NULL OR checkout_address <> 'Machine')
   ORDER BY date, id`,
  [username]
);

console.log("NON_MACHINE");
for (const r of detail) console.log(`${r.d} ${r.cin} -> ${r.cout} [${r.addr}]`);
console.log("--- SPAN");
for (const r of rows) {
  console.log(`${r.d} in=${r.earliest_in} out=${r.latest_out} machineRows=${r.machine_rows} other=${r.other_rows}`);
}
await conn.end();
