import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import {
  cloneClientExpenseFromTemplate,
  deleteDedicatedExpenseForStatement,
  applyExpenseAllocation,
} from "@/lib/statementClientExpenseLink";
import { revalidateClientExpensePages } from "@/lib/revalidateClientExpensePages";
import { resetMysqlAutoIncrementIfEmpty } from "@/lib/resetMysqlAutoIncrementIfEmpty";
import {
  deriveStatementInvoiceStatus,
  parseLinkedPurchaseTokens,
} from "@/lib/statementLinkedPurchases";

export async function GET(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { id } = await params;
    const conn = await getDbConnection();
    // Ensure invoice_status column exists
    try {
      await conn.execute("SELECT invoice_status FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN invoice_status VARCHAR(50) NULL");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT expense_allocation FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute(
          "ALTER TABLE statements ADD COLUMN expense_allocation TEXT NULL AFTER client_expense_id",
        );
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT linked_purchase_ids FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE statements ADD COLUMN linked_purchase_ids TEXT NULL");
      } catch (__) {}
    }
    const [rows] = await conn.execute(
      `SELECT id, trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, client_expense_id, invoice_status, expense_allocation, linked_purchase_ids, created_at
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

    let expenseAllocationJson = null;
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
    if (allocObj != null) {
      expenseAllocationJson = JSON.stringify(allocObj);
    }

    if (!trans_id || !date || !type || amount == null || amount === "") {
      return NextResponse.json(
        { error: "trans_id, date, type, and amount are required" },
        { status: 400 }
      );
    }

    const pool = await getDbConnection();
    try {
      await pool.execute("SELECT expense_allocation FROM statements LIMIT 1");
    } catch (_) {
      try {
        await pool.execute(
          "ALTER TABLE statements ADD COLUMN expense_allocation TEXT NULL AFTER client_expense_id",
        );
      } catch (__) {}
    }
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
      try {
        await conn.execute("SELECT linked_purchase_ids FROM statements LIMIT 1");
      } catch (_) {
        try {
          await conn.execute("ALTER TABLE statements ADD COLUMN linked_purchase_ids TEXT NULL");
        } catch (__) {}
      }
      try {
        await conn.execute("SELECT invoice_status FROM statements LIMIT 1");
      } catch (_) {
        try {
          await conn.execute("ALTER TABLE statements ADD COLUMN invoice_status VARCHAR(50) NULL");
        } catch (__) {}
      }
      const [prevRows] = await conn.execute(
        `SELECT client_expense_id, trans_id, linked_purchase_ids FROM statements WHERE id = ?`,
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
        const nextInvoiceStatus = deriveStatementInvoiceStatus(
          prev?.linked_purchase_ids,
          formEid,
        );
        const [result] = await conn.execute(
          `UPDATE statements SET
        trans_id = ?, date = ?, txn_dated_deb = ?, txn_posted_date = ?, cheq_no = ?,
        description = ?, type = ?, amount = ?, client_expense_id = ?, expense_allocation = ?, invoice_status = ?
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
            expenseAllocationJson,
            nextInvoiceStatus,
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
        if (allocObj != null) {
          await applyExpenseAllocation(conn, formEid, allocObj, null);
        }
        revalidateExpenseIds.add(formEid);
      } else {
        if (prevEid != null && Number.isFinite(prevEid) && prevEid >= 1) {
          revalidateExpenseIds.add(prevEid);
          await deleteDedicatedExpenseForStatement(conn, prevEid, prevTransId);
        }

        let finalExpenseId = null;
        if (formEid != null) {
          // If user picked an already-dedicated expense for this statement (txn matches),
          // reuse it instead of creating yet another clone.
          const [ceRows] = await conn.execute(
            `SELECT id, transaction_id FROM client_expenses WHERE id = ?`,
            [formEid],
          );
          const ce = ceRows?.[0];
          const ceTxn = String(ce?.transaction_id ?? "").trim();
          if (ce && ceTxn === String(trans_id ?? "").trim()) {
            finalExpenseId = Number(ce.id);
            await conn.execute(
              `UPDATE client_expenses SET amount = ROUND(?, 2), transaction_id = ? WHERE id = ?`,
              [newAmt, trans_id, finalExpenseId],
            );
            if (allocObj != null) {
              await applyExpenseAllocation(conn, finalExpenseId, allocObj, null);
            }
          } else {
            finalExpenseId = await cloneClientExpenseFromTemplate(conn, formEid, {
              amount: newAmt,
              transId: trans_id,
              allocation: allocObj || undefined,
            });
          }
          if (finalExpenseId != null) {
            revalidateExpenseIds.add(formEid);
            revalidateExpenseIds.add(finalExpenseId);
          }
        }

        const nextInvoiceStatus = deriveStatementInvoiceStatus(
          prev?.linked_purchase_ids,
          finalExpenseId,
        );
        const [result] = await conn.execute(
          `UPDATE statements SET
        trans_id = ?, date = ?, txn_dated_deb = ?, txn_posted_date = ?, cheq_no = ?,
        description = ?, type = ?, amount = ?, client_expense_id = ?, expense_allocation = ?, invoice_status = ?
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
            expenseAllocationJson,
            nextInvoiceStatus,
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
    try {
      revalidatePath("/admin-dashboard/statements");
    } catch (_) {}

    const poolAfter = await getDbConnection();
    const connReset = await poolAfter.getConnection();
    try {
      await resetMysqlAutoIncrementIfEmpty(connReset, "client_expenses");
    } finally {
      connReset.release();
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

export async function PATCH(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const purchaseIdRaw = body?.purchase_id ?? body?.purchaseId;
    const purchaseTypeRaw = body?.purchase_type ?? body?.purchaseType;
    const action = body?.action || "link"; // "link" or "unlink"
    const purchaseId = Number(purchaseIdRaw);
    if (!Number.isFinite(purchaseId) || purchaseId <= 0) {
      return NextResponse.json({ error: "purchase_id is required" }, { status: 400 });
    }
    const normalizePurchaseType = (val) => {
      const s = String(val ?? "").trim().toUpperCase();
      if (!s) return "PP";
      if (s === "PP" || s === "PRODUCT") return "PP";
      if (s === "PS" || s === "SP" || s === "SPARE") return "PS";
      return "PP";
    };
    const purchaseType = normalizePurchaseType(purchaseTypeRaw);

    const pool = await getDbConnection();
    try {
      await pool.execute("SELECT invoice_status FROM statements LIMIT 1");
    } catch (_) {
      try {
        await pool.execute("ALTER TABLE statements ADD COLUMN invoice_status VARCHAR(50) NULL");
      } catch (__) {}
    }
    try {
      await pool.execute("SELECT linked_purchase_ids FROM statements LIMIT 1");
    } catch (_) {
      try {
        await pool.execute("ALTER TABLE statements ADD COLUMN linked_purchase_ids TEXT NULL");
      } catch (__) {}
    }

    const conn = await pool.getConnection();
    let committed = false;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        "SELECT linked_purchase_ids FROM statements WHERE id = ?",
        [id],
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        await conn.rollback();
        return NextResponse.json({ error: "Statement not found" }, { status: 404 });
      }

      let currentTokens = parseLinkedPurchaseTokens(rows[0]?.linked_purchase_ids);
      const token = `${purchaseType}${purchaseId}`;

      if (action === "link") {
        if (!currentTokens.includes(token)) {
          currentTokens.push(token);
        }
      } else if (action === "unlink") {
        currentTokens = currentTokens.filter((t) => t !== token);
      }

      const nextLinkedIds = currentTokens.length > 0 ? JSON.stringify(currentTokens) : null;
      const nextStatus = (currentTokens.length > 0) ? "Settled" : "Unsettled";

      await conn.execute(
        "UPDATE statements SET linked_purchase_ids = ?, invoice_status = ? WHERE id = ?",
        [nextLinkedIds, nextStatus, id],
      );

      await conn.commit();
      committed = true;
      return NextResponse.json({ success: true, linked_purchase_ids: currentTokens });
    } finally {
      if (!committed) {
        try {
          await conn.rollback();
        } catch (_) {}
      }
      conn.release();
    }
  } catch (err) {
    console.error("[statements-api] PATCH error:", err?.message || err);
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
      await resetMysqlAutoIncrementIfEmpty(conn2, "statements");
      await resetMysqlAutoIncrementIfEmpty(conn2, "client_expenses");
    } finally {
      conn2.release();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[statements-api] DELETE error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
