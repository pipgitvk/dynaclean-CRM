import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { resetMysqlAutoIncrementIfEmpty } from "@/lib/resetMysqlAutoIncrementIfEmpty";
import { jwtVerify } from "jose";

export async function DELETE(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const conn = await getDbConnection();
    const [result] = await conn.execute("DELETE FROM statements");
    await resetMysqlAutoIncrementIfEmpty(conn, "statements");

    return NextResponse.json({
      success: true,
      deleted: result.affectedRows,
    });
  } catch (err) {
    console.error("[statements-delete-all] error:", err?.message);
    return NextResponse.json({ error: err?.message || "Delete failed" }, { status: 500 });
  }
}
