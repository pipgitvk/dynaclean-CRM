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
    try {
      await conn.execute("SELECT transaction_id FROM client_expenses LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE client_expenses ADD COLUMN transaction_id VARCHAR(255) NULL AFTER hsn");
      } catch (__) {}
    }
    const [rows] = await conn.execute(
      `SELECT id, expense_name, client_name, group_name, tax_applicable, tax_type, main_head, head, supply, type_of_ledger, cgst, sgst, igst, hsn, transaction_id, gst_rate, amount, created_at
       FROM client_expenses WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Client expense not found" }, { status: 404 });
    }

    const [subHeadsRows] = await conn.execute(
      `SELECT id, sub_head FROM client_expense_sub_heads WHERE client_expense_id = ? ORDER BY id`,
      [id]
    );
    const sub_heads = subHeadsRows.map((r) => r.sub_head || "");

    return NextResponse.json({ ...rows[0], sub_heads });
  } catch (err) {
    console.error("[client-expenses-api] GET error:", err?.message || err);
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
    const { expense_name, client_name, group_name, tax_applicable, tax_type, main_head, head, supply, sub_heads, type_of_ledger, cgst, sgst, igst, hsn, transaction_id, gst_rate, amount } = data;

    const txnId =
      transaction_id != null && String(transaction_id).trim() !== "" ? String(transaction_id).trim() : null;

    if (!expense_name || !client_name || !main_head) {
      return NextResponse.json(
        { error: "expense_name, client_name, and main_head are required" },
        { status: 400 }
      );
    }

    if (!txnId) {
      return NextResponse.json({ error: "transaction_id is required" }, { status: 400 });
    }

    if (!["Direct", "Indirect"].includes(main_head)) {
      return NextResponse.json(
        { error: "main_head must be Direct or Indirect" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    try {
      await conn.execute("SELECT tax_type FROM client_expenses LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE client_expenses ADD COLUMN tax_type VARCHAR(50) NULL AFTER tax_applicable");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT transaction_id FROM client_expenses LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE client_expenses ADD COLUMN transaction_id VARCHAR(255) NULL AFTER hsn");
      } catch (__) {}
    }
    const validSupply = ["goods", "services"].includes(supply) ? supply : null;
    const [result] = await conn.execute(
      `UPDATE client_expenses SET
        expense_name = ?, client_name = ?, group_name = ?, tax_applicable = ?, tax_type = ?, main_head = ?, head = ?, supply = ?,
        type_of_ledger = ?, cgst = ?, sgst = ?, igst = ?, hsn = ?, transaction_id = ?, gst_rate = ?, amount = ?
       WHERE id = ?`,
      [
        expense_name,
        client_name,
        group_name || null,
        tax_applicable ? 1 : 0,
        tax_applicable && tax_type ? tax_type : null,
        main_head,
        head || null,
        validSupply,
        type_of_ledger || null,
        cgst != null && cgst !== "" ? Number(cgst) : null,
        sgst != null && sgst !== "" ? Number(sgst) : null,
        igst != null && igst !== "" ? Number(igst) : null,
        hsn || null,
        txnId,
        gst_rate != null && gst_rate !== "" ? Number(gst_rate) : null,
        amount != null && amount !== "" ? Number(amount) : null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Client expense not found" }, { status: 404 });
    }

    await conn.execute("DELETE FROM client_expense_sub_heads WHERE client_expense_id = ?", [id]);
    const subHeadsList = Array.isArray(sub_heads) ? sub_heads : [];
    for (const sh of subHeadsList) {
      if (sh && typeof sh === "string" && sh.trim()) {
        await conn.execute(
          `INSERT INTO client_expense_sub_heads (client_expense_id, sub_head) VALUES (?, ?)`,
          [id, sh.trim()]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[client-expenses-api] PUT error:", err?.message || err);
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

    await conn.execute("UPDATE statements SET client_expense_id = NULL WHERE client_expense_id = ?", [id]);
    await conn.execute("DELETE FROM client_expense_sub_heads WHERE client_expense_id = ?", [id]);
    const [result] = await conn.execute("DELETE FROM client_expenses WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Client expense not found" }, { status: 404 });
    }

    const [countRows] = await conn.execute("SELECT COUNT(*) as cnt FROM client_expenses");
    if (countRows[0].cnt === 0) {
      await conn.execute("ALTER TABLE client_expenses AUTO_INCREMENT = 1");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[client-expenses-api] DELETE error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
