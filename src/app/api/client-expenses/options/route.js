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

    const [headRows] = await conn.execute(
      `SELECT DISTINCT head FROM client_expenses WHERE head IS NOT NULL AND head != '' ORDER BY head`
    );
    let heads = headRows.map((r) => r.head).filter(Boolean);
    if (heads.length === 0) heads = ["Salary", "Rent", "Utilities", "Supplies", "Marketing", "Other"];

    const [subHeadRows] = await conn.execute(
      `SELECT DISTINCT sub_head FROM client_expense_sub_heads WHERE sub_head IS NOT NULL AND sub_head != '' ORDER BY sub_head`
    );
    let sub_heads = subHeadRows.map((r) => r.sub_head).filter(Boolean);
    if (sub_heads.length === 0) sub_heads = ["Office", "Travel", "Equipment", "Misc", "Other"];

    return NextResponse.json({ heads, sub_heads });
  } catch (err) {
    console.error("[client-expenses-options] GET error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
