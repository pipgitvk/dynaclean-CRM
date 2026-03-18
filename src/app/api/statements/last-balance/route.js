import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT id, date, type, amount FROM statements ORDER BY date ASC, id ASC`
    );

    let lastBalance = 0;
    for (const r of rows) {
      const amt = Number(r.amount || 0);
      lastBalance += r.type === "Credit" ? amt : -amt;
    }

    return NextResponse.json({ lastBalance: Math.round(lastBalance * 100) / 100 });
  } catch (err) {
    console.error("[statements-last-balance] error:", err?.message);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
