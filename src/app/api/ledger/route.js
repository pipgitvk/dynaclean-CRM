/*  */import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET /api/ledger
export async function GET(request) {
  const payload = await getSessionPayload();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT id, entry_date, particulars, vch_type, vch_no, debit, credit, buyer_name, created_at
       FROM ledger_entries
       ORDER BY entry_date DESC, id DESC`
    );
    return NextResponse.json({ entries: rows });
  } catch (err) {
    console.error("[ledger GET]", err?.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// POST /api/ledger
export async function POST(request) {
  const payload = await getSessionPayload();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { entry_date, particulars, vch_type, vch_no = "", debit = 0, credit = 0, buyer_name = null } = body;

  if (!entry_date) return NextResponse.json({ error: "entry_date is required" }, { status: 400 });
  if (!particulars?.trim()) return NextResponse.json({ error: "particulars is required" }, { status: 400 });
  if (!vch_type?.trim()) return NextResponse.json({ error: "vch_type is required" }, { status: 400 });

  const debitVal = parseFloat(debit) || 0;
  const creditVal = parseFloat(credit) || 0;
  if (debitVal === 0 && creditVal === 0) {
    return NextResponse.json({ error: "Debit or Credit must be > 0" }, { status: 400 });
  }

  try {
    const conn = await getDbConnection();

    // Ensure buyer_name column exists
    try {
      await conn.execute("SELECT buyer_name FROM ledger_entries LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE ledger_entries ADD COLUMN buyer_name VARCHAR(255) NULL");
      } catch (__) {}
    }

    const [result] = await conn.execute(
      `INSERT INTO ledger_entries (entry_date, particulars, vch_type, vch_no, debit, credit, buyer_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entry_date, particulars.trim(), vch_type.trim(), vch_no.trim(), debitVal, creditVal, buyer_name || null]
    );

    const insertId = result.insertId;
    const [rows] = await conn.execute(
      `SELECT id, entry_date, particulars, vch_type, vch_no, debit, credit, buyer_name, created_at
       FROM ledger_entries WHERE id = ?`,
      [insertId]
    );

    return NextResponse.json({ entry: rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[ledger POST]", err?.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
