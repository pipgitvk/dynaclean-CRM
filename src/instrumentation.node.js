/**
 * Node-only: mute DB connection terminal noise (does not fix DB/SSL).
 */
import { isDbConnectionError } from "@/lib/db";

// Avoid shell / URI metacharacters in process env consumed by child tooling.
for (const key of ["DB_PASS", "DB_PASSWORD"]) {
  const value = process.env[key];
  if (value && /[&+]/.test(value)) {
    process.env[key] = value.split(/[&+]/)[0];
  }
}

const NOISE_RE =
  /handshake_no_ssl_support|server does not support secure connection|secure connection|protocol_connection_lost|pool is closed|too many connections|er_access_denied_error|er_con_count_error|er_user_limit_reached|econnreset|econnrefused|etimedout|enotfound|connection lost|server closed the connection|recreating mysql pool|\[db\] recreating/i;

const looksLikeDbConnNoise = (...args) => {
  for (const arg of args) {
    if (isDbConnectionError(arg)) return true;
    if (typeof arg === "string" && NOISE_RE.test(arg)) return true;
    if (arg && typeof arg === "object") {
      try {
        if (NOISE_RE.test(JSON.stringify(arg))) return true;
      } catch {
        // ignore circular
      }
      if (arg.stack && NOISE_RE.test(String(arg.stack))) return true;
      if (arg.message && NOISE_RE.test(String(arg.message))) return true;
      if (arg.code && NOISE_RE.test(String(arg.code))) return true;
    }
  }
  return false;
};

if (!globalThis.__dbConnLogMute__) {
  globalThis.__dbConnLogMute__ = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  const origLog = console.log.bind(console);
  console.error = (...args) => {
    if (looksLikeDbConnNoise(...args)) return;
    origError(...args);
  };
  console.warn = (...args) => {
    if (looksLikeDbConnNoise(...args)) return;
    origWarn(...args);
  };
  console.log = (...args) => {
    if (looksLikeDbConnNoise(...args)) return;
    origLog(...args);
  };

  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, encoding, cb) => {
    const text =
      typeof chunk === "string"
        ? chunk
        : Buffer.isBuffer(chunk)
          ? chunk.toString("utf8")
          : String(chunk);
    if (NOISE_RE.test(text)) {
      if (typeof encoding === "function") encoding();
      else if (typeof cb === "function") cb();
      return true;
    }
    return origWrite(chunk, encoding, cb);
  };
}

if (!globalThis.__dbConnRejectionMute__) {
  globalThis.__dbConnRejectionMute__ = true;
  process.on("unhandledRejection", (reason) => {
    if (isDbConnectionError(reason)) return;
  });
}
