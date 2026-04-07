import { NextResponse } from "next/server";
import { getMainSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  try {
    // Get the real (non-impersonated) session user
    const payload = await getMainSessionPayload();
    if (!payload) {
      return NextResponse.json({ allowed: false, reason: "no_session" }, { status: 401 });
    }

    const username = payload.username;

    // Get client IP
    let ip =
      request.ip ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (ip.includes(",")) ip = ip.split(",")[0].trim();

    const conn = await getDbConnection();

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

    // If user not found in DB, allow (don't lock out)
    if (rows.length === 0) {
      return NextResponse.json({ allowed: true });
    }

    const user = rows[0];
    const isRestricted = user.ip_restriction_enabled === 1;
    const allowedIps = (user.allowed_ips || "")
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);

    if (isRestricted && allowedIps.length > 0 && !allowedIps.includes(ip)) {
      return NextResponse.json(
        { allowed: false, reason: "ip_not_allowed", currentIp: ip },
        { status: 403 }
      );
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    console.error("Error in check-session-ip:", error);
    // Fail open on DB error to avoid lockouts
    return NextResponse.json({ allowed: true });
  }
}
