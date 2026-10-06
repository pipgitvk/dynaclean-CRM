"use server";

import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isUnknownApprovalNoteColumnError } from "@/lib/specialPriceApprovalNoteColumn";
import {
  dealerApprovalNoteForTerm,
  isDealerPriceType,
  resolveDealerPriceFromProductStock,
} from "@/lib/specialPriceDefaults";

async function lookupStockDealerPrice(conn, itemType, productId, priceTerm) {
  const type = String(itemType || "").toLowerCase();
  if (type !== "product") return null;
  const pid = Number(productId);
  if (!Number.isFinite(pid) || pid <= 0) return null;
  const [rows] = await conn.execute(
    `SELECT dp, dp_no_warranty FROM products_list WHERE id = ? LIMIT 1`,
    [pid],
  );
  return resolveDealerPriceFromProductStock(priceTerm, rows[0]);
}

function getFormDataFromActionArgs(first, second) {
  if (second !== undefined && second && typeof second.get === "function") {
    return second;
  }
  if (first && typeof first.get === "function") {
    return first;
  }
  return null;
}

export async function updateSpecialPrice(formData) {
  const id = formData.get("id");
  const specialPrice = formData.get("special_price");

  const payload = await getSessionPayload();
  if (!payload || payload.role !== "SUPERADMIN") return;

  const conn = await getDbConnection();

  await conn.execute(
    `
    UPDATE special_price
    SET special_price = ?, status = 'pending'
    WHERE id = ?
    `,
    [Number(specialPrice), Number(id)]
  );

  redirect("/admin-dashboard/special-pricing");
}

/* =========================
   DELETE SPECIAL PRICE
========================= */
export async function deleteSpecialPrice(formData) {
  const id = formData.get("id");

  const payload = await getSessionPayload();
  if (!payload || payload.role !== "SUPERADMIN") return;

  const conn = await getDbConnection();

  await conn.execute(
    `DELETE FROM special_price WHERE id = ?`,
    [Number(id)]
  );

  redirect("/admin-dashboard/special-pricing");
}

/* =========================
   APPROVE / REJECT (with required note)
========================= */
export async function decideSpecialPrice(prevState, formData) {
  const fd = getFormDataFromActionArgs(prevState, formData);
  if (!fd) {
    return { error: "Invalid request." };
  }

  const id = fd.get("id");
  const itemType = String(fd.get("itemType") || "product").toLowerCase().trim();
  const decision = String(fd.get("decision") || "").toLowerCase().trim();
  const note = String(fd.get("note") || "").trim();
  const dealerPriceRaw = fd.get("dealer_price");

  if (!id || Number.isNaN(Number(id))) {
    return { error: "Invalid record." };
  }
  if (!["product", "spare"].includes(itemType)) {
    return { error: "Invalid item type." };
  }
  if (decision !== "approve" && decision !== "reject") {
    return { error: "Invalid decision." };
  }
  if (!note) {
    return { error: "Note is required before submitting." };
  }

  const payload = await getSessionPayload();
  if (!payload || !["SUPERADMIN", "DIRECTOR"].includes(String(payload.role).toUpperCase())) {
    return { error: "Unauthorized." };
  }

  const actor =
    (typeof payload.username === "string" && payload.username.trim()) ||
    (typeof payload.name === "string" && payload.name.trim()) ||
    "admin";

  const conn = await getDbConnection();
  const numericId = Number(id);
  // Both products and spares are now in the same special_price table

  if (decision === "approve") {
    const [existingRows] = await conn.execute(
      `SELECT special_price, price_type, price_term, item_type, product_id
       FROM special_price WHERE id = ? LIMIT 1`,
      [numericId],
    );
    const existing = existingRows[0];
    const needsDealerPrice =
      isDealerPriceType(existing?.price_type) &&
      Number(existing?.special_price || 0) === 0;

    let approvedPrice = null;
    let approvalNote = note;
    if (needsDealerPrice) {
      const autoPrice = await lookupStockDealerPrice(
        conn,
        existing.item_type,
        existing.product_id,
        existing.price_term,
      );
      if (autoPrice != null) {
        approvedPrice = autoPrice;
        approvalNote = dealerApprovalNoteForTerm(existing.price_term);
      } else {
        const dealerPrice = Number(dealerPriceRaw);
        if (!Number.isFinite(dealerPrice) || dealerPrice <= 0) {
          return {
            error:
              "Dealer price is required. Set DP or DP No-Warranty on product stock.",
          };
        }
        approvedPrice = dealerPrice;
      }
    }

    try {
      if (approvedPrice !== null) {
        await conn.execute(
          `
          UPDATE special_price
          SET
            special_price = ?,
            status = 'approved',
            approved_by = ?,
            approved_date = NOW(),
            approval_note = ?
          WHERE id = ?
          `,
          [approvedPrice, actor, approvalNote, numericId],
        );
      } else {
        await conn.execute(
          `
          UPDATE special_price
          SET
            status = 'approved',
            approved_by = ?,
            approved_date = NOW(),
            approval_note = ?
          WHERE id = ?
          `,
          [actor, approvalNote, numericId],
        );
      }
    } catch (e) {
      if (!isUnknownApprovalNoteColumnError(e)) throw e;
      if (approvedPrice !== null) {
        await conn.execute(
          `
          UPDATE special_price
          SET
            special_price = ?,
            status = 'approved',
            approved_by = ?,
            approved_date = NOW()
          WHERE id = ?
          `,
          [approvedPrice, actor, numericId],
        );
      } else {
        await conn.execute(
          `
          UPDATE special_price
          SET
            status = 'approved',
            approved_by = ?,
            approved_date = NOW()
          WHERE id = ?
          `,
          [actor, numericId],
        );
      }
    }
  } else {
    try {
      await conn.execute(
        `
        UPDATE special_price
        SET
          status = 'rejected',
          approved_by = ?,
          approved_date = NOW(),
          approval_note = ?
        WHERE id = ?
        `,
        [actor, note, numericId],
      );
    } catch (e) {
      if (!isUnknownApprovalNoteColumnError(e)) throw e;
      await conn.execute(
        `
        UPDATE special_price
        SET
          status = 'rejected',
          approved_by = ?,
          approved_date = NOW()
        WHERE id = ?
        `,
        [actor, numericId],
      );
    }
  }

  redirect("/admin-dashboard/special-pricing");
}

/* =========================
   BULK APPROVE (same page selection)
========================= */
export async function bulkApproveSpecialPrices(prevState, formData) {
  const fd = getFormDataFromActionArgs(prevState, formData);
  if (!fd) {
    return { error: "Invalid request." };
  }

  const note = String(fd.get("note") || "").trim();
  let ids = [];
  try {
    const raw = fd.get("ids");
    ids = JSON.parse(String(raw || "[]"));
  } catch {
    return { error: "Invalid selection." };
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "Select at least one row to approve." };
  }
  if (!note) {
    return { error: "Note is required before submitting." };
  }

  const payload = await getSessionPayload();
  if (
    !payload ||
    !["SUPERADMIN", "DIRECTOR"].includes(String(payload.role).toUpperCase())
  ) {
    return { error: "Unauthorized." };
  }

  const actor =
    (typeof payload.username === "string" && payload.username.trim()) ||
    (typeof payload.name === "string" && payload.name.trim()) ||
    "admin";

  const conn = await getDbConnection();
  const numericIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (numericIds.length === 0) {
    return { error: "Invalid selection." };
  }

  const placeholders = numericIds.map(() => "?").join(", ");
  const [rows] = await conn.execute(
    `SELECT id, status, price_type, special_price, price_term, item_type, product_id
     FROM special_price WHERE id IN (${placeholders})`,
    numericIds,
  );

  const approvable = [];
  for (const row of rows) {
    const status = String(row.status || "").toLowerCase();
    if (status === "approved" || status === "rejected") continue;
    const needsDealer =
      isDealerPriceType(row.price_type) &&
      Number(row.special_price || 0) === 0;
    if (needsDealer) {
      const autoPrice = await lookupStockDealerPrice(
        conn,
        row.item_type,
        row.product_id,
        row.price_term,
      );
      if (autoPrice == null) continue;
      approvable.push({
        id: Number(row.id),
        price: autoPrice,
        approvalNote: dealerApprovalNoteForTerm(row.price_term),
      });
      continue;
    }
    approvable.push({ id: Number(row.id), price: null, approvalNote: note });
  }

  if (approvable.length === 0) {
    return {
      error:
        "None of the selected rows can be bulk-approved (already decided or missing DP on product stock).",
    };
  }

  for (const item of approvable) {
    const rowNote = item.approvalNote;
    try {
      if (item.price != null) {
        await conn.execute(
          `
          UPDATE special_price
          SET
            special_price = ?,
            status = 'approved',
            approved_by = ?,
            approved_date = NOW(),
            approval_note = ?
          WHERE id = ?
          `,
          [item.price, actor, rowNote, item.id],
        );
      } else {
        await conn.execute(
          `
          UPDATE special_price
          SET
            status = 'approved',
            approved_by = ?,
            approved_date = NOW(),
            approval_note = ?
          WHERE id = ?
          `,
          [actor, rowNote, item.id],
        );
      }
    } catch (e) {
      if (!isUnknownApprovalNoteColumnError(e)) throw e;
      if (item.price != null) {
        await conn.execute(
          `
          UPDATE special_price
          SET
            special_price = ?,
            status = 'approved',
            approved_by = ?,
            approved_date = NOW()
          WHERE id = ?
          `,
          [item.price, actor, item.id],
        );
      } else {
        await conn.execute(
          `
          UPDATE special_price
          SET
            status = 'approved',
            approved_by = ?,
            approved_date = NOW()
          WHERE id = ?
          `,
          [actor, item.id],
        );
      }
    }
  }

  redirect("/admin-dashboard/special-pricing");
}
