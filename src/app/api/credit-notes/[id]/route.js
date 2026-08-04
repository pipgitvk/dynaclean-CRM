import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT * FROM credit_notes WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, error: "Credit note not found" }, { status: 404 });
    }

    const cn = rows[0];

    // Parse items JSON if stored as string
    if (typeof cn.items === "string") {
      try { cn.items = JSON.parse(cn.items); } catch { cn.items = []; }
    }

    return NextResponse.json({ success: true, creditNote: cn });
  } catch (err) {
    console.error("GET /api/credit-notes/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const conn = await getDbConnection();

    // Ensure is_saved / saved_at columns exist
    try {
      await conn.execute(
        `ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS is_saved TINYINT(1) NOT NULL DEFAULT 0`
      );
      await conn.execute(
        `ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS saved_at DATETIME NULL DEFAULT NULL`
      );
    } catch (_) {}

    await conn.execute(
      `UPDATE credit_notes SET is_saved = 1, saved_at = NOW() WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, message: "Credit note saved." });
  } catch (err) {
    console.error("PATCH /api/credit-notes/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
