import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

const INTERNAL_SECRET = process.env.JWT_SECRET || "your-secret";

export async function GET(request) {
  // Only allow calls from middleware (internal)
  const internalHeader = request.headers.get("x-internal-secret");
  if (internalHeader !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();
    const ip = searchParams.get("ip")?.trim();

    if (!username || !ip) {
      return NextResponse.json({ allowed: true });
    }

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
      return NextResponse.json({ allowed: false });
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    console.error("Error in validate-ip:", error);
    // Fail open to avoid lockouts on DB error
    return NextResponse.json({ allowed: true });
  }
}
