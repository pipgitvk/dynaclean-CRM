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

    const { searchParams } = new URL(req.url);
    const rootOnly = searchParams.get("root_only") === "1";

    const conn = await getDbConnection();
    try {
      await conn.execute("SELECT transaction_id FROM client_expenses LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE client_expenses ADD COLUMN transaction_id VARCHAR(255) NULL AFTER hsn");
      } catch (__) {}
    }

    const selectCols = `ce.id, ce.expense_name, ce.client_name, ce.group_name, ce.tax_applicable, ce.tax_type, ce.main_head, ce.head, ce.supply, ce.type_of_ledger, ce.cgst, ce.sgst, ce.igst, ce.hsn, ce.transaction_id, ce.gst_rate, ce.amount, ce.created_at`;

    const [rows] = rootOnly
      ? await conn.execute(
          `SELECT ${selectCols}
           FROM client_expenses ce
           INNER JOIN (
             SELECT MIN(id) AS id
             FROM client_expenses
             GROUP BY client_name, COALESCE(group_name, ''), expense_name
           ) r ON ce.id = r.id
           ORDER BY ce.id DESC`,
        )
      : await conn.execute(
          `SELECT id, expense_name, client_name, group_name, tax_applicable, tax_type, main_head, head, supply, type_of_ledger, cgst, sgst, igst, hsn, transaction_id, gst_rate, amount, created_at
           FROM client_expenses
           ORDER BY id DESC`,
        );

    return NextResponse.json({ clientExpenses: rows });
  } catch (err) {
    console.error("[client-expenses-api] GET error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

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

    if (!["Direct", "Indirect"].includes(main_head)) {
      return NextResponse.json(
        { error: "main_head must be Direct or Indirect" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    try {
      await conn.execute("SELECT tax_applicable, tax_type FROM client_expenses LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE client_expenses ADD COLUMN tax_applicable TINYINT(1) NOT NULL DEFAULT 0 AFTER group_name");
      } catch (__) {}
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
    const [insertResult] = await conn.execute(
      `INSERT INTO client_expenses (expense_name, client_name, group_name, tax_applicable, tax_type, main_head, head, supply, type_of_ledger, cgst, sgst, igst, hsn, transaction_id, gst_rate, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );

    const clientExpenseId = insertResult.insertId;
    const subHeadsList = Array.isArray(sub_heads) ? sub_heads : [];
    for (const sh of subHeadsList) {
      if (sh && typeof sh === "string" && sh.trim()) {
        await conn.execute(
          `INSERT INTO client_expense_sub_heads (client_expense_id, sub_head) VALUES (?, ?)`,
          [clientExpenseId, sh.trim()]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[client-expenses-api] POST error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
