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

// Mutex for pool creation to prevent race conditions
let poolCreationLock = null;
let isCreatingPool = false;

function createMysqlPool() {
  const DB_HOST = requiredEnv("DB_HOST");
  const DB_USER = requiredEnv("DB_USER");
  const DB_PASSWORD = process.env.DB_PASSWORD || "";
  const DB_NAME = requiredEnv("DB_NAME");



  console.log({
    host: DB_HOST,
    user: DB_USER,
    database: DB_NAME,
    passwordLength: DB_PASSWORD.length,
  });

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
     * CRITICAL: Idle timeout prevents connection leaks
     * Closes idle connections after 30 seconds to free up resources
     * This prevents ER_USER_LIMIT_REACHED errors
     */
    idleTimeout: 30000,

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

async function recreatePool() {
  if (isCreatingPool && poolCreationLock) {
    console.log("⚠️ [DB] Waiting for existing pool creation to complete...");
    await poolCreationLock;
    return;
  }

  let resolveLock;
  poolCreationLock = new Promise((resolve) => {
    resolveLock = resolve;
  });

  isCreatingPool = true;

  try {
    console.log("⚠️ [DB] Recreating MySQL pool...");

    // IMPORTANT: old pool ko properly close karo
    const oldPool = g.__mysqlPool;

    if (oldPool) {
      try {
        await oldPool.end();
        console.log("✅ [DB] Old MySQL pool closed");
      } catch (err) {
        console.error("⚠️ [DB] Error closing old pool:", err.message);
      }
    }

    delete g.__mysqlPool;

    g.__mysqlPool = createMysqlPool();

  } finally {
    isCreatingPool = false;
    resolveLock();
    poolCreationLock = null;
  }
}

function shouldRecreatePool(error) {
  const message = error?.message || "";
  const code = error?.code || "";
  return (
    message.includes("Pool is closed") ||
    code === "POOL_CLOSED" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT"
  );
}

export async function getDbConnection() {
  // If we're in the middle of creating a pool, wait for it
  if (isCreatingPool && poolCreationLock) {
    console.log("⚠️ [DB] Waiting for pool to be created...");
    await poolCreationLock;
  }

  if (!g.__mysqlPool) {
    await recreatePool();
  }

  return g.__mysqlPool;
}

export async function dbQuery(sql, params = [], retry = true) {
  try {
    const db = await getDbConnection();
    const [rows] = await db.query(sql, params);
    return rows;
  } catch (error) {
    if (retry && shouldRecreatePool(error)) {
      console.log("⚠️ [DB] Recreating pool and retrying query...");
      await recreatePool();
      // Retry once with new pool
      return dbQuery(sql, params, false);
    }
    throw error;
  }
}

export async function dbExecute(sql, params = [], retry = true) {
  try {
    const db = await getDbConnection();
    const [result] = await db.execute(sql, params);
    return result;
  } catch (error) {
    if (retry && shouldRecreatePool(error)) {
      console.log("⚠️ [DB] Recreating pool and retrying execute...");
      await recreatePool();
      // Retry once with new pool
      return dbExecute(sql, params, false);
    }
    throw error;
  }
}

export async function withPool(callback, retry = true) {
  try {
    const db = await getDbConnection();
    return await callback(db);
  } catch (error) {
    if (retry && shouldRecreatePool(error)) {
      console.log("⚠️ [DB] Recreating pool and retrying withPool...");
      await recreatePool();
      // Retry once with new pool
      return withPool(callback, false);
    }
    throw error;
  }
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
