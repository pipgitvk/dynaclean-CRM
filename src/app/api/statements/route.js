import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import { cloneClientExpenseFromTemplate } from "@/lib/statementClientExpenseLink";
import { revalidateClientExpensePages } from "@/lib/revalidateClientExpensePages";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { searchParams } = new URL(req.url);
    const expenseId = searchParams.get("expense_id");

    const conn = await getDbConnection();
    try {
      await conn.execute("SELECT txn_posted_date FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN txn_posted_date DATE NULL AFTER txn_dated_deb");
      } catch (__) {}
    }
    // Ensure invoice_number column exists
    try {
      await conn.execute("SELECT invoice_number FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN invoice_number VARCHAR(100) NULL");
      } catch (__) {}
    }

    let rows;
    // Ensure invoice_status column exists
    try {
      await conn.execute("SELECT invoice_status FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN invoice_status VARCHAR(50) NULL");
      } catch (__) {}
    }

    try {
      await conn.execute("SELECT closing_balance FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN closing_balance DECIMAL(18,2) NULL");
      } catch (__) {}
    }

    if (expenseId) {
      [rows] = await conn.execute(
        `SELECT id, trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, closing_balance, client_expense_id, invoice_number, invoice_status, created_at
         FROM statements
         WHERE client_expense_id = ?
         ORDER BY id DESC`,
        [expenseId]
      );
    } else {
      [rows] = await conn.execute(
        `SELECT id, trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, closing_balance, client_expense_id, invoice_number, invoice_status, created_at
         FROM statements
         ORDER BY date DESC, id DESC`
      );
    }

    return NextResponse.json({ statements: rows });
  } catch (err) {
    console.error("[statements-api] GET error:", err?.message || err);
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
    const {
      trans_id,
      date,
      txn_dated_deb,
      txn_posted_date,
      cheq_no,
      description,
      type,
      amount,
      client_expense_id,
      expense_allocation,
    } = data;

    const allocObj =
      expense_allocation != null && typeof expense_allocation === "object"
        ? {
            includeHead: expense_allocation.includeHead !== false,
            includeSubs: Array.isArray(expense_allocation.includeSubs)
              ? expense_allocation.includeSubs.map((s) => String(s || "").trim()).filter(Boolean)
              : [],
            headLabel:
              expense_allocation.headLabel != null &&
              String(expense_allocation.headLabel).trim() !== ""
                ? String(expense_allocation.headLabel).trim()
                : null,
          }
        : null;
    const expenseAllocationJson = allocObj != null ? JSON.stringify(allocObj) : null;

    if (!trans_id || !date || !type || amount == null || amount === "") {
      return NextResponse.json(
        { error: "trans_id, date, type, and amount are required" },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();
    try {
      await pool.execute("SELECT txn_posted_date FROM statements LIMIT 1");
    } catch (_) {
      try {
        await pool.execute(
          "ALTER TABLE statements ADD COLUMN txn_posted_date DATE NULL AFTER txn_dated_deb",
        );
      } catch (__) {}
    }
    const [existing] = await pool.execute(
      "SELECT id FROM statements WHERE trans_id = ?",
      [trans_id],
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Trans ID already exists. Please use a unique Trans ID." },
        { status: 400 },
      );
    }
    const expenseIdVal = client_expense_id ? Number(client_expense_id) : null;
    const amt = Number(amount) || 0;

    try {
      await pool.execute("SELECT expense_allocation FROM statements LIMIT 1");
    } catch (_) {
      try {
        await pool.execute(
          "ALTER TABLE statements ADD COLUMN expense_allocation TEXT NULL AFTER client_expense_id",
        );
      } catch (__) {}
    }

    const c = await pool.getConnection();
    const revalidateIds = new Set();
    try {
      await c.beginTransaction();
      let finalExpenseId = null;
      if (
        expenseIdVal != null &&
        Number.isFinite(expenseIdVal) &&
        expenseIdVal >= 1
      ) {
        finalExpenseId = await cloneClientExpenseFromTemplate(c, expenseIdVal, {
          amount: amt,
          transId: trans_id,
          allocation: allocObj || undefined,
        });
        revalidateIds.add(expenseIdVal);
        if (finalExpenseId != null) revalidateIds.add(finalExpenseId);
      }
      await c.execute(
        `INSERT INTO statements (trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, client_expense_id, expense_allocation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trans_id,
          date,
          txn_dated_deb || null,
          txn_posted_date || null,
          cheq_no || null,
          description || null,
          type,
          amt,
          finalExpenseId,
          expenseAllocationJson,
        ],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }

    revalidateClientExpensePages([...revalidateIds]);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Trans ID already exists. Please use a unique Trans ID." },
        { status: 400 }
      );
    }
    console.error("[statements-api] POST error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH: link invoice_number to statements by trans_ids
export async function PATCH(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { trans_ids, invoice_number, invoice_status } = await req.json();

    if (!invoice_number || !Array.isArray(trans_ids) || trans_ids.length === 0) {
      return NextResponse.json(
        { error: "invoice_number and trans_ids array are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Ensure invoice_number column exists
    try {
      await conn.execute("SELECT invoice_number FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN invoice_number VARCHAR(100) NULL");
      } catch (__) {}
    }
    // Ensure invoice_status column exists
    try {
      await conn.execute("SELECT invoice_status FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN invoice_status VARCHAR(50) NULL");
      } catch (__) {}
    }

    const placeholders = trans_ids.map(() => "?").join(", ");
    const statusVal = invoice_status || "Unsettled";
    await conn.execute(
      `UPDATE statements SET invoice_number = ?, invoice_status = ? WHERE trans_id IN (${placeholders})`,
      [invoice_number, statusVal, ...trans_ids]
    );

    return NextResponse.json({ success: true, updated: trans_ids.length });
  } catch (err) {
    console.error("[statements-api] PATCH error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
