import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import {
  cloneClientExpenseFromTemplate,
  deleteDedicatedExpenseForStatement,
} from "@/lib/statementClientExpenseLink";
import { revalidateClientExpensePages } from "@/lib/revalidateClientExpensePages";

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

    const pool = await getDbConnection();
    const conn = await pool.getConnection();
    const [existing] = await conn.execute(
      "SELECT id FROM statements WHERE trans_id = ? AND id != ?",
      [trans_id, id]
    );
    if (existing.length > 0) {
      conn.release();
      return NextResponse.json(
        { error: "Trans ID already exists. Please use a unique Trans ID." },
        { status: 400 }
      );
    }
    const expenseIdVal = client_expense_id ? Number(client_expense_id) : null;
    const newAmt = Number(amount) || 0;
    const revalidateExpenseIds = new Set();

    try {
      await conn.beginTransaction();
      const [prevRows] = await conn.execute(
        `SELECT client_expense_id, trans_id FROM statements WHERE id = ?`,
        [id],
      );
      const prev = prevRows?.[0];
      if (!prev) {
        await conn.rollback();
        return NextResponse.json({ error: "Statement not found" }, { status: 404 });
      }

      const prevEid =
        prev.client_expense_id != null ? Number(prev.client_expense_id) : null;
      const prevTransId = String(prev.trans_id ?? "").trim();
      const formEid =
        expenseIdVal != null && Number.isFinite(expenseIdVal) && expenseIdVal >= 1
          ? expenseIdVal
          : null;

      const sameLink =
        formEid != null && prevEid != null && Number(formEid) === Number(prevEid);

      if (sameLink) {
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
            newAmt,
            formEid,
            id,
          ],
        );
        if (result.affectedRows === 0) {
          await conn.rollback();
          return NextResponse.json({ error: "Statement not found" }, { status: 404 });
        }
        await conn.execute(
          `UPDATE client_expenses SET amount = ROUND(?, 2), transaction_id = ? WHERE id = ?`,
          [newAmt, trans_id, formEid],
        );
        revalidateExpenseIds.add(formEid);
      } else {
        if (prevEid != null && Number.isFinite(prevEid) && prevEid >= 1) {
          revalidateExpenseIds.add(prevEid);
          await deleteDedicatedExpenseForStatement(conn, prevEid, prevTransId);
        }

        let finalExpenseId = null;
        if (formEid != null) {
          finalExpenseId = await cloneClientExpenseFromTemplate(conn, formEid, {
            amount: newAmt,
            transId: trans_id,
          });
          if (finalExpenseId != null) {
            revalidateExpenseIds.add(formEid);
            revalidateExpenseIds.add(finalExpenseId);
          }
        }

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
            newAmt,
            finalExpenseId,
            id,
          ],
        );
        if (result.affectedRows === 0) {
          await conn.rollback();
          return NextResponse.json({ error: "Statement not found" }, { status: 404 });
        }
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    revalidateClientExpensePages([...revalidateExpenseIds]);

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
    const pool = await getDbConnection();
    const conn = await pool.getConnection();
    let expenseIdToRevalidate = null;
    try {
      await conn.beginTransaction();
      const [prevRows] = await conn.execute(
        `SELECT client_expense_id, trans_id FROM statements WHERE id = ?`,
        [id],
      );
      const prev = prevRows?.[0];
      const eid = prev?.client_expense_id != null ? Number(prev.client_expense_id) : null;
      const prevTransId = String(prev?.trans_id ?? "").trim();
      if (eid && Number.isFinite(eid) && eid >= 1) {
        expenseIdToRevalidate = eid;
        await deleteDedicatedExpenseForStatement(conn, eid, prevTransId);
      }
      const [result] = await conn.execute("DELETE FROM statements WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        await conn.rollback();
        return NextResponse.json({ error: "Statement not found" }, { status: 404 });
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    revalidateClientExpensePages(
      expenseIdToRevalidate != null ? [expenseIdToRevalidate] : [],
    );

    const conn2 = await pool.getConnection();
    try {
      const [countRows] = await conn2.execute("SELECT COUNT(*) as cnt FROM statements");
      if (countRows[0].cnt === 0) {
        await conn2.execute("ALTER TABLE statements AUTO_INCREMENT = 1");
      }
    } finally {
      conn2.release();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[statements-api] DELETE error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
