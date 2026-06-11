// lib/db.js
import mysql from "mysql2/promise";

const g = globalThis;

/**
 * MySQL connection pool
 * - Uses DB_HOST directly, no manual DNS/IP resolving
 * - Prevents too many connections during Next.js dev HMR
 * - Returns DATE/DATETIME as strings to avoid timezone conversion issues
 */

function requiredEnv(name) {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`${name} is missing in environment variables.`);
  }

  return value;
}

function createMysqlPool() {
  const DB_HOST = requiredEnv("DB_HOST");
  const DB_USER = requiredEnv("DB_USER");
  const DB_PASSWORD = requiredEnv("DB_PASSWORD");
  const DB_NAME = requiredEnv("DB_NAME");

  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,

    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,

    connectTimeout: 10000,

    /**
     * Important:
     * DATE/DATETIME/TIMESTAMP strings me return honge.
     * Isse frontend me UTC/IST double conversion issue nahi aayega.
     */
    dateStrings: true,

    /**
     * Keep connection stable on hosting providers.
     */
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    /**
     * Agar Hostinger MySQL SSL require karta ho to .env me DB_SSL=true set kar dena.
     */
    ssl:
      process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  });

  console.log("✅ [DB] MySQL pool created");
  console.log("✅ [DB] Host:", DB_HOST);
  console.log("✅ [DB] Database:", DB_NAME);

  return pool;
}

export async function getDbConnection() {
  if (!g.__mysqlPool) {
    g.__mysqlPool = createMysqlPool();
  }

  try {
    /**
     * Quick health check
     * Agar pool closed/broken hai to recreate ho jayega.
     */
    const connection = await g.__mysqlPool.getConnection();
    connection.release();

    return g.__mysqlPool;
  } catch (error) {
    const message = error?.message || "";
    const code = error?.code || "";

    console.error("❌ [DB] Pool health check failed:", {
      code,
      message,
    });

    if (
      message.includes("Pool is closed") ||
      code === "POOL_CLOSED" ||
      code === "PROTOCOL_CONNECTION_LOST" ||
      code === "ECONNRESET" ||
      code === "ETIMEDOUT"
    ) {
      console.log("⚠️ [DB] Recreating MySQL pool...");

      try {
        await g.__mysqlPool.end();
      } catch (_) {
        // ignore end error
      }

      delete g.__mysqlPool;
      g.__mysqlPool = createMysqlPool();

      return g.__mysqlPool;
    }

    throw error;
  }
}

export async function dbQuery(sql, params = []) {
  const db = await getDbConnection();
  const [rows] = await db.query(sql, params);
  return rows;
}

export async function dbExecute(sql, params = []) {
  const db = await getDbConnection();
  const [result] = await db.execute(sql, params);
  return result;
}

export async function getDbDebugInfo() {
  const db = await getDbConnection();

  const [rows] = await db.query(`
    SELECT 
      DATABASE() AS db,
      @@hostname AS mysqlHost,
      @@port AS mysqlPort,
      @@server_id AS serverId,
      @@global.time_zone AS globalTimeZone,
      @@session.time_zone AS sessionTimeZone,
      NOW() AS nowTime,
      CURDATE() AS today
  `);

  return rows[0];
}