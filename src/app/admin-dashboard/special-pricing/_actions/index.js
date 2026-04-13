"use server";

import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isUnknownApprovalNoteColumnError } from "@/lib/specialPriceApprovalNoteColumn";

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
  const decision = String(fd.get("decision") || "").toLowerCase().trim();
  const note = String(fd.get("note") || "").trim();

  if (!id || Number.isNaN(Number(id))) {
    return { error: "Invalid record." };
  }
  if (decision !== "approve" && decision !== "reject") {
    return { error: "Invalid decision." };
  }
  if (!note) {
    return { error: "Note is required before submitting." };
  }

  const payload = await getSessionPayload();
  if (!payload || payload.role !== "SUPERADMIN") {
    return { error: "Unauthorized." };
  }

  const actor =
    (typeof payload.username === "string" && payload.username.trim()) ||
    (typeof payload.name === "string" && payload.name.trim()) ||
    "admin";

  const conn = await getDbConnection();
  const numericId = Number(id);

  if (decision === "approve") {
    try {
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
        [actor, note, numericId],
      );
    } catch (e) {
      if (!isUnknownApprovalNoteColumnError(e)) throw e;
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

    try {
      const [rows] = await conn.execute(
        `SELECT product_id, special_price FROM special_price WHERE id = ? LIMIT 1`,
        [numericId],
      );

      if (rows.length > 0) {
        const { product_id, special_price } = rows[0];

        await conn.execute(
          `
          UPDATE products_list
          SET last_negotiation_price = ?
          WHERE id = ?
        `,
          [Number(special_price), Number(product_id)],
        );
      }
    } catch (e) {
      console.error(
        "⚠️ Failed to update products_list.last_negotiation_price on approval:",
        e,
      );
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
