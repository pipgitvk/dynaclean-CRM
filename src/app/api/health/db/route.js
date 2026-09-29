import { NextResponse } from "next/server";

/**
 * Lightweight DB readiness probe — does not open a pool (avoids load on shared hosting).
 * Checks that required env keys exist and look non-empty.
 */
export async function GET() {
  const required = ["DB_HOST", "DB_USRE", "DB_NAME"];
  const missing = required.filter((key) => !String(process.env[key] || "").trim());
  const hasPassword = Boolean(
    String(process.env.DB_PASSWORD || process.env.DB_PASS || "").trim(),
  );

  if (missing.length > 0 || !hasPassword) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        missing,
        hasPassword,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    host: process.env.DB_HSOT,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL !== "false",
    message: "Database configuration looks valid",
  });
}
