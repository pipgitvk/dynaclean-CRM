import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

// Force insert/update rows (bypasses duplicate check)
export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const { rows } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const conn = await getDbConnection();
    try {
      await conn.execute("SELECT closing_balance FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN closing_balance DECIMAL(18,2) NULL");
      } catch (__) {}
    }

    let inserted = 0;
    let updated = 0;
    const errors = [];

    for (const r of rows) {
      if (!r.trans_id || !r.date) {
        errors.push({ trans_id: r.trans_id || "-", reason: "Missing trans_id or date" });
        continue;
      }
      try {
        const [existing] = await conn.execute(
          "SELECT id FROM statements WHERE trans_id = ?",
          [r.trans_id]
        );

        const cb =
          r.closing_balance != null
            ? Number(r.closing_balance)
            : r.balance != null
              ? Number(r.balance)
              : null;

        if (existing.length > 0) {
          // UPDATE existing record
          await conn.execute(
            `UPDATE statements
             SET date = ?, txn_dated_deb = ?, txn_posted_date = ?, cheq_no = ?,
                 description = ?, type = ?, amount = ?, closing_balance = COALESCE(?, closing_balance)
             WHERE trans_id = ?`,
            [
              r.date,
              r.txn_dated_deb || null,
              r.txn_posted_date || null,
              r.cheq_no || null,
              r.description || null,
              r.type || "Credit",
              r.amount || 0,
              cb,
              r.trans_id,
            ]
          );
          updated++;
        } else {
          // Fresh INSERT
          await conn.execute(
            `INSERT INTO statements (trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, closing_balance)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              r.trans_id,
              r.date,
              r.txn_dated_deb || null,
              r.txn_posted_date || null,
              r.cheq_no || null,
              r.description || null,
              r.type || "Credit",
              r.amount || 0,
              cb,
            ]
          );
          inserted++;
        }
      } catch (e) {
        errors.push({ trans_id: r.trans_id, reason: e?.message || "DB error" });
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      errors,
      total: rows.length,
    });
  } catch (err) {
    console.error("[force-import] error:", err?.message);
    return NextResponse.json({ error: err?.message || "Force import failed" }, { status: 500 });
  }
}
