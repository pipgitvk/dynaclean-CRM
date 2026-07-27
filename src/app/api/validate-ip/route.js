import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cacheGetOrSet } from "@/lib/cache";

const INTERNAL_SECRET = process.env.JWT_SECRET || "your-secret";

export async function GET(request) {
  // Only allow calls from middleware (internal)
  const internalHeader = request.headers.get("x-internal-secret");
  if (internalHeader !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let conn;
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();
    const ip = searchParams.get("ip")?.trim();

    if (!username || !ip) {
      return NextResponse.json({ allowed: true });
    }

    // 🎯 Use cache to avoid repeated database queries
    // TTL: 300 seconds (5 minutes) - IP restrictions don't change that often
    const cacheKey = `ip-validate:${username}:${ip}`;
    
    const result = await cacheGetOrSet(
      cacheKey,
      async () => {
        const pool = await getDbConnection();
        conn = await pool.getConnection();

        try {
          // Check emplist first, then rep_list
          let [rows] = await conn.execute(
            "SELECT allowed_ips, ip_restriction_enabled FROM emplist WHERE LOWER(username) = LOWER(?)",
            [username]
          );

          if (rows.length === 0) {
            [rows] = await conn.execute(
              "SELECT allowed_ips, ip_restriction_enabled FROM rep_list WHERE LOWER(username) = LOWER(?)",
              [username]
            );
          }

          if (rows.length === 0) {
            return { allowed: true };
          }

          const user = rows[0];
          const isRestricted = user.ip_restriction_enabled === 1;
          const allowedIps = (user.allowed_ips || "")
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean);

          if (isRestricted && allowedIps.length > 0 && !allowedIps.includes(ip)) {
            return { allowed: false };
          }

          return { allowed: true };
        } finally {
          if (conn) {
            try {
              await conn.release();
            } catch (releaseError) {
              console.error("Error releasing connection:", releaseError);
            }
          }
        }
      },
      300 // 5-minute cache
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in validate-ip:", error);
    // Fail open to avoid lockouts on DB error
    return NextResponse.json({ allowed: true });
  }
}
