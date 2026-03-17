import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

export async function GET(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { id } = await params;
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT id, trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, client_expense_id, created_at
       FROM statements WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("[statements-api] GET error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { id } = await params;
    const data = await req.json();
    const { trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, client_expense_id } = data;

    if (!trans_id || !date || !type || amount == null || amount === "") {
      return NextResponse.json(
        { error: "trans_id, date, type, and amount are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [existing] = await conn.execute(
      "SELECT id FROM statements WHERE trans_id = ? AND id != ?",
      [trans_id, id]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Trans ID already exists. Please use a unique Trans ID." },
        { status: 400 }
      );
    }
    const expenseIdVal = client_expense_id ? Number(client_expense_id) : null;
    const [result] = await conn.execute(
      `UPDATE statements SET
        trans_id = ?, date = ?, txn_dated_deb = ?, txn_posted_date = ?, cheq_no = ?,
        description = ?, type = ?, amount = ?, client_expense_id = ?
       WHERE id = ?`,
      [
        trans_id,
        date,
        txn_dated_deb || null,
        txn_posted_date || null,
        cheq_no || null,
        description || null,
        type,
        Number(amount) || 0,
        expenseIdVal,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Trans ID already exists. Please use a unique Trans ID." },
        { status: 400 }
      );
    }
    console.error("[statements-api] PUT error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { id } = await params;
    const conn = await getDbConnection();
    const [result] = await conn.execute("DELETE FROM statements WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    const [countRows] = await conn.execute("SELECT COUNT(*) as cnt FROM statements");
    if (countRows[0].cnt === 0) {
      await conn.execute("ALTER TABLE statements AUTO_INCREMENT = 1");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[statements-api] DELETE error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
