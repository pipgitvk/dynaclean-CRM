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

  await conn.execute(
    `
    UPDATE special_price
    SET 
      status = 'approved',
      approved_by = ?,
      approved_date = NOW()
    WHERE id = ?
    `,
    [payload.id, Number(id)]
  );

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
    [payload.id, Number(id)]
  );

  redirect("/admin-dashboard/special-pricing");
}
