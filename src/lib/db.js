// lib/db.js
import mysql from "mysql2/promise";
import { promises as dns } from "dns";

/** Survives Next.js dev HMR so we do not open a new pool per module reload (avoids MySQL "Too many connections"). */
const g = globalThis;

// Resolve DB host to IPv4 (once per process)
async function resolveDbHost() {
  if (g.__mysqlResolvedIpv4) return g.__mysqlResolvedIpv4;

  const host = process.env.DB_HOST;
  if (!host) throw new Error("DB_HOST is missing in environment variables.");

  try {
    const { address } = await dns.lookup(host, { family: 4 });
    g.__mysqlResolvedIpv4 = address;
    console.log(`✅ [DB] Resolved ${host} to IPv4: ${address}`);
    return address;
  } catch (err) {
    console.error("❌ [DB] Failed to resolve DB_HOST:", err);
    throw new Error("DNS resolution failed for DB_HOST");
  }
}

export async function getDbConnection() {
  if (!g.__mysqlPool) {
    const host = await resolveDbHost();

    g.__mysqlPool = mysql.createPool({
      host,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      // Keep this conservative in dev; large values can overwhelm MySQL `max_connections`.
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      /**
       * Return DATE/DATETIME/TIMESTAMP as strings (e.g. "2026-04-01 04:29:03") instead of JS Date.
       * Otherwise JSON APIs serialize Date as ISO UTC ("...Z") and the frontend adds +5:30 again for IST.
       */
      dateStrings: true,
    });

    console.log("✅ [DB] Connection pool created");
  }

  return g.__mysqlPool;
}
