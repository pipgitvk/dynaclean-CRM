import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";


export async function updateSpecialPrice(formData) {
  "use server";

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
  "use server";

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
   APPROVE
========================= */
export async function approveSpecialPrice(formData) {
  "use server";

  const id = formData.get("id");

  const payload = await getSessionPayload();
  if (!payload || payload.role !== "SUPERADMIN") return;

  const conn = await getDbConnection();

  // Approve the special price entry
  await conn.execute(
    `
    UPDATE special_price
    SET 
      status = 'approved',
      approved_by = ?,
      approved_date = NOW()
    WHERE id = ?
    `,
    ["admin", Number(id)]
  );

  // After approval, reflect this in products_list.last_negotiation_price
  try {
    const [rows] = await conn.execute(
      `SELECT product_id, special_price FROM special_price WHERE id = ? LIMIT 1`,
      [Number(id)],
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

  redirect("/admin-dashboard/special-pricing");
}

/* =========================
   REJECT
========================= */
export async function rejectSpecialPrice(formData) {
  "use server";

  const id = formData.get("id");

  const payload = await getSessionPayload();
  if (!payload || payload.role !== "SUPERADMIN") return;

  const conn = await getDbConnection();

  await conn.execute(
    `
    UPDATE special_price
    SET 
      status = 'rejected',
      approved_by = ?,
      approved_date = NOW()
    WHERE id = ?
    `,
    ["admin", Number(id)]
  );

  redirect("/admin-dashboard/view-customer");
}
