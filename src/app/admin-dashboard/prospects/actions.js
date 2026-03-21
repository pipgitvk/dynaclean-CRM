"use server";

import { redirect } from "next/navigation";
import { getDbConnection } from "@/lib/db";
import { ensureProspectsTable } from "@/lib/ensureProspectsTable";
import { getSessionPayload } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  canAccessProspectsRole,
  isProspectsAdminRole,
} from "@/lib/prospectAccess";
import {
  getTodayYmdIST,
  validateCommitmentDateForCreate,
  canFinalSubmitWithCommitment,
} from "@/lib/prospectCommitmentRules";
import { userMayUseCustomerForProspect } from "@/lib/prospectCustomerAccess";

const NOTES_MAX = 4000;

function normalizeNotes(formData, key = "notes") {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  return raw.length > NOTES_MAX ? raw.slice(0, NOTES_MAX) : raw;
}

export async function createProspect(formData) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessProspectsRole(payload.role)) {
    redirect("/admin-dashboard/prospects?error=unauthorized");
  }

  const customer_id = String(formData.get("customer_id") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const qtyRaw = formData.get("qty");
  const amountRaw = formData.get("amount");
  const commitmentRaw = String(formData.get("commitment_date") ?? "").trim();

  if (!customer_id || !model) {
    redirect("/admin-dashboard/prospects/new?error=required");
  }

  const qtyParsed = parseInt(String(qtyRaw ?? "").trim(), 10);
  if (!Number.isFinite(qtyParsed) || qtyParsed < 1) {
    redirect("/admin-dashboard/prospects/new?error=qty");
  }
  const qty = qtyParsed;
  const amount = parseFloat(String(amountRaw).replace(/,/g, "")) || 0;
  const commitment_date = commitmentRaw ? commitmentRaw : null;
  const notes = normalizeNotes(formData);
  const order_id_raw = String(formData.get("order_id") ?? "").trim();
  const order_id = order_id_raw || null;

  const todayIst = getTodayYmdIST();
  const createCommitCheck = validateCommitmentDateForCreate(
    commitmentRaw,
    todayIst,
  );
  if (!createCommitCheck.ok) {
    redirect("/admin-dashboard/prospects/new?error=commitment_past");
  }

  const createdBy = String(payload.username ?? "").trim() || null;

  await ensureProspectsTable();
  const conn = await getDbConnection();
  const mayUse = await userMayUseCustomerForProspect(conn, customer_id, payload);
  if (!mayUse) {
    redirect("/admin-dashboard/prospects/new?error=forbidden_customer");
  }

  await conn.execute(
    `INSERT INTO prospects (customer_id, order_id, model, qty, amount, commitment_date, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, order_id, model, qty, amount, commitment_date, notes, createdBy],
  );

  redirect("/admin-dashboard/prospects");
}

export async function updateProspect(formData) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessProspectsRole(payload.role)) {
    redirect("/admin-dashboard/prospects?error=unauthorized");
  }

  const idNum = parseInt(String(formData.get("prospect_id") ?? "").trim(), 10);
  if (!Number.isFinite(idNum) || idNum < 1) {
    redirect("/admin-dashboard/prospects?error=required");
  }

  const customer_id = String(formData.get("customer_id") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const qtyRaw = formData.get("qty");
  const amountRaw = formData.get("amount");
  const commitmentRaw = String(formData.get("commitment_date") ?? "").trim();

  if (!customer_id || !model) {
    redirect(
      `/admin-dashboard/prospects/${idNum}/edit?error=required`,
    );
  }

  const qtyParsed = parseInt(String(qtyRaw ?? "").trim(), 10);
  if (!Number.isFinite(qtyParsed) || qtyParsed < 1) {
    redirect(`/admin-dashboard/prospects/${idNum}/edit?error=qty`);
  }
  const qty = qtyParsed;
  const amount = parseFloat(String(amountRaw).replace(/,/g, "")) || 0;
  const commitment_date = commitmentRaw ? commitmentRaw : null;
  const notes = normalizeNotes(formData);

  const todayIst = getTodayYmdIST();
  const updateCommitCheck = validateCommitmentDateForCreate(
    commitmentRaw,
    todayIst,
  );
  if (!updateCommitCheck.ok) {
    redirect(`/admin-dashboard/prospects/${idNum}/edit?error=commitment_past`);
  }
  if (!canFinalSubmitWithCommitment(commitmentRaw, todayIst)) {
    redirect(`/admin-dashboard/prospects/${idNum}/edit?error=final_deadline`);
  }

  await ensureProspectsTable();
  const conn = await getDbConnection();
  const admin = isProspectsAdminRole(payload.role);
  const user = String(payload.username ?? "").trim();

  let result;
  if (admin) {
    [result] = await conn.execute(
      `UPDATE prospects SET model = ?, qty = ?, amount = ?, commitment_date = ?, notes = ?, finalized_at = CURRENT_TIMESTAMP
       WHERE id = ? AND finalized_at IS NULL`,
      [model, qty, amount, commitment_date, notes, idNum],
    );
  } else {
    if (!user) {
      redirect(`/admin-dashboard/prospects/${idNum}/edit?error=unauthorized`);
    }
    [result] = await conn.execute(
      `UPDATE prospects SET model = ?, qty = ?, amount = ?, commitment_date = ?, notes = ?, finalized_at = CURRENT_TIMESTAMP
       WHERE id = ? AND created_by = ? AND finalized_at IS NULL`,
      [model, qty, amount, commitment_date, notes, idNum, user],
    );
  }

  const affected = result?.affectedRows ?? 0;
  if (affected < 1) {
    const [again] = await conn.execute(
      `SELECT finalized_at FROM prospects WHERE id = ?`,
      [idNum],
    );
    const againRow = again?.[0];
    if (againRow?.finalized_at != null) {
      redirect(`/admin-dashboard/prospects/${idNum}/edit?error=locked`);
    }
    redirect(`/admin-dashboard/prospects/${idNum}/edit?error=forbidden`);
  }

  revalidatePath("/admin-dashboard/prospects");
  redirect("/admin-dashboard/prospects");
}

export async function deleteProspect(id) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessProspectsRole(payload.role)) {
    return { ok: false, error: "Unauthorized" };
  }

  const idNum = parseInt(String(id), 10);
  if (!Number.isFinite(idNum) || idNum < 1) {
    return { ok: false, error: "Invalid id" };
  }

  await ensureProspectsTable();
  const conn = await getDbConnection();
  const admin = isProspectsAdminRole(payload.role);
  const user = String(payload.username ?? "").trim();

  let result;
  if (admin) {
    [result] = await conn.execute(`DELETE FROM prospects WHERE id = ?`, [
      idNum,
    ]);
  } else {
    if (!user) {
      return { ok: false, error: "Missing username" };
    }
    [result] = await conn.execute(
      `DELETE FROM prospects WHERE id = ? AND created_by = ?`,
      [idNum, user],
    );
  }

  const affected = result?.affectedRows ?? 0;
  if (affected < 1) {
    return { ok: false, error: "Not found or not allowed" };
  }

  revalidatePath("/admin-dashboard/prospects");
  return { ok: true };
}

const MAX_BULK_CUSTOMERS = 50;
const MAX_LINES_PER_CUSTOMER = 25;
/** Max quotation lines summed across all customers in one bulk submit (before merging per customer). */
const MAX_BULK_LINE_ITEMS = 100;

export async function createProspectsBulk(formData) {
  const payload = await getSessionPayload();
  if (!payload || !canAccessProspectsRole(payload.role)) {
    redirect("/admin-dashboard/prospects/new?error=unauthorized");
  }

  const customerCount = Math.min(
    MAX_BULK_CUSTOMERS,
    Math.max(0, parseInt(String(formData.get("customer_count")), 10) || 0),
  );
  if (customerCount < 1) {
    redirect("/admin-dashboard/prospects/new?error=required");
  }

  const formQuoteNumber = String(
    formData.get("prospects_quote_number") ?? "",
  ).trim();
  const formQuoteNumbers = String(
    formData.get("prospects_quote_numbers") ?? "",
  ).trim();
  const quoteNumbersArr = formQuoteNumbers
    ? formQuoteNumbers.split(",").map((s) => s.trim())
    : [];
  const quoteForCustomer = (i) =>
    (quoteNumbersArr[i] || formQuoteNumber || "").trim() || null;

  function redirectCustomers(suffix) {
    const ids = [];
    for (let j = 0; j < customerCount; j++) {
      const id = String(formData.get(`customer_id_${j}`) ?? "").trim();
      if (id) ids.push(id);
    }
    let quoteQs = "";
    if (formQuoteNumbers) {
      quoteQs = `&quote_numbers=${encodeURIComponent(formQuoteNumbers)}`;
    } else if (formQuoteNumber) {
      quoteQs = `&quote_number=${encodeURIComponent(formQuoteNumber)}`;
    }
    redirect(
      `/admin-dashboard/prospects/new?${suffix}&customers=${encodeURIComponent(ids.join(","))}${quoteQs}`,
    );
  }

  const todayIstBulk = getTodayYmdIST();
  const collected = [];
  let bulkLineItemCount = 0;

  for (let i = 0; i < customerCount; i++) {
    const customer_id = String(
      formData.get(`customer_id_${i}`) ?? "",
    ).trim();
    const lineCount = Math.min(
      MAX_LINES_PER_CUSTOMER,
      Math.max(1, parseInt(String(formData.get(`line_count_${i}`)), 10) || 1),
    );
    const commitmentRaw = String(
      formData.get(`commitment_date_${i}`) ?? "",
    ).trim();
    const notes = normalizeNotes(formData, `notes_${i}`);
    const order_id_i =
      String(formData.get(`order_id_${i}`) ?? "").trim() || null;

    if (!customer_id) {
      redirectCustomers("error=required");
    }

    const bulkCommitCheck = validateCommitmentDateForCreate(
      commitmentRaw,
      todayIstBulk,
    );
    if (!bulkCommitCheck.ok) {
      redirectCustomers("error=commitment_past");
    }

    const commitment_date = commitmentRaw ? commitmentRaw : null;
    /** @type {{ model: string, qty: number, amount: number }[]} */
    const lineRows = [];

    for (let j = 0; j < lineCount; j++) {
      const model = String(formData.get(`model_${i}_${j}`) ?? "").trim();
      if (!model) continue;

      const qtyRaw = formData.get(`qty_${i}_${j}`);
      const amountRaw = formData.get(`amount_${i}_${j}`);
      const qtyParsed = parseInt(String(qtyRaw ?? "").trim(), 10);
      if (!Number.isFinite(qtyParsed) || qtyParsed < 1) {
        redirectCustomers("error=qty");
      }
      const qty = qtyParsed;
      const amount = parseFloat(String(amountRaw).replace(/,/g, "")) || 0;

      lineRows.push({ model, qty, amount });
      bulkLineItemCount++;
      if (bulkLineItemCount > MAX_BULK_LINE_ITEMS) {
        redirectCustomers("error=too_many");
      }
    }

    if (lineRows.length < 1) {
      redirectCustomers("error=required");
    }

    // One prospect row per bulk form block (each block may be same customer, different quotation).
    const quote_number = quoteForCustomer(i);
    if (lineRows.length === 1) {
      const [only] = lineRows;
      collected.push({
        customer_id,
        order_id: order_id_i,
        quote_number,
        model: only.model,
        qty: only.qty,
        amount: only.amount,
        commitment_date,
        notes,
      });
    } else {
      const totalQty = lineRows.reduce((a, l) => a + l.qty, 0);
      const totalAmount = lineRows.reduce((a, l) => a + l.amount, 0);
      const modelDisplay = lineRows
        .map((l) => `${l.model} (Qty ${l.qty})`)
        .join(" · ");
      collected.push({
        customer_id,
        order_id: order_id_i,
        quote_number,
        model: modelDisplay,
        qty: totalQty,
        amount: totalAmount,
        commitment_date,
        notes,
      });
    }
  }

  const createdBy = String(payload.username ?? "").trim() || null;

  await ensureProspectsTable();
  const pool = await getDbConnection();
  const connection = await pool.getConnection();

  try {
    for (const r of collected) {
      const ok = await userMayUseCustomerForProspect(
        connection,
        r.customer_id,
        payload,
      );
      if (!ok) {
        redirectCustomers("error=forbidden_customer");
      }
    }
    await connection.beginTransaction();
    for (const r of collected) {
      await connection.execute(
        `INSERT INTO prospects (customer_id, order_id, quote_number, model, qty, amount, commitment_date, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.customer_id,
          r.order_id ?? null,
          r.quote_number ?? null,
          r.model,
          r.qty,
          r.amount,
          r.commitment_date,
          r.notes,
          createdBy,
        ],
      );
    }
    await connection.commit();
  } catch {
    await connection.rollback();
    const ids = collected.map((r) => r.customer_id).join(",");
    const quoteQs = formQuoteNumber
      ? `&quote_number=${encodeURIComponent(formQuoteNumber)}`
      : "";
    redirect(
      `/admin-dashboard/prospects/new?error=db&customers=${encodeURIComponent(ids)}${quoteQs}`,
    );
  } finally {
    connection.release();
  }

  redirect("/admin-dashboard/prospects");
}
