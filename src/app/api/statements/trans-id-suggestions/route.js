import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

/** Escape special LIKE chars; use ESCAPE '|' in query */
function escapeLike(str) {
  return String(str)
    .replace(/\|/g, "||")
    .replace(/%/g, "|%")
    .replace(/_/g, "|_");
}

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { searchParams } = new URL(req.url);
    const rawQ = (searchParams.get("q") || "").trim().slice(0, 120);

    const conn = await getDbConnection();

    let rows;
    if (rawQ.length === 0) {
      [rows] = await conn.execute(
        `SELECT trans_id
         FROM statements
         WHERE client_expense_id IS NULL AND trans_id IS NOT NULL AND trans_id != ''
         ORDER BY date DESC, id DESC
         LIMIT 40`
      );
    } else {
      const pattern = `%${escapeLike(rawQ)}%`;
      [rows] = await conn.execute(
        `SELECT trans_id
         FROM statements
         WHERE trans_id LIKE ? ESCAPE '|'
         ORDER BY (client_expense_id IS NULL) DESC, date DESC, id DESC
         LIMIT 40`,
        [pattern]
      );
    }

    const transIds = rows.map((r) => r.trans_id).filter(Boolean);
    return NextResponse.json({ transIds });
  } catch (err) {
    console.error("[trans-id-suggestions] GET error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
