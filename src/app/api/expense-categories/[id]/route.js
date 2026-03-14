import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { id } = await params;
    const conn = await getDbConnection();
    const [result] = await conn.execute("DELETE FROM expense_categories WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const [countRows] = await conn.execute("SELECT COUNT(*) as cnt FROM expense_categories");
    if (countRows[0].cnt === 0) {
      await conn.execute("ALTER TABLE expense_categories AUTO_INCREMENT = 1");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[expense-categories] DELETE error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
