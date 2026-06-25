import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// DELETE /api/ledger/[id]
export async function DELETE(request, { params }) {
  const payload = await getSessionPayload();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (!entryId || isNaN(entryId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const conn = await getDbConnection();
    const [result] = await conn.execute(
      `DELETE FROM ledger_entries WHERE id = ?`,
      [entryId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ledger DELETE]", err?.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
