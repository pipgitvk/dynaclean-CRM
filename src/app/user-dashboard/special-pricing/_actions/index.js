import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";

/* =========================
   UPDATE SPECIAL PRICE
========================= */
export async function updateSpecialPrice(formData) {
  "use server";

  const id = formData.get("id");
  const customerId = formData.get("customer_id");
  const specialPrice = formData.get("special_price");

  if (!id || !customerId) return;

  const payload = await getSessionPayload();
  if (!payload) return;

  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    // Check current status to prevent editing approved records
    const [rows] = await conn.execute(
      `SELECT status FROM special_price WHERE id = ? AND customer_id = ? LIMIT 1`,
      [Number(id), Number(customerId)]
    );

    const current = rows[0];
    if (!current) {
      redirect(`/user-dashboard/special-pricing/${customerId}`);
      return;
    }

    if (current.status === "approved") {
      redirect(`/user-dashboard/special-pricing/${customerId}`);
      return;
    }

    await conn.execute(
      `
      UPDATE special_price
      SET special_price = ?, status = 'pending', approved_by = NULL, approved_date = NULL
      WHERE id = ? AND customer_id = ?
      `,
      [Number(specialPrice), Number(id), Number(customerId)]
    );

    redirect(`/user-dashboard/special-pricing/${customerId}`);
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
}

/* =========================
   DELETE SPECIAL PRICE
========================= */
export async function deleteSpecialPrice(formData) {
  "use server";

  const id = formData.get("id");
  const customerId = formData.get("customer_id");

  if (!id || !customerId) return;

  const payload = await getSessionPayload();
  if (!payload) return;

  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    await conn.execute(
      `DELETE FROM special_price WHERE id = ? AND customer_id = ?`,
      [Number(id), Number(customerId)]
    );

    redirect(`/user-dashboard/special-pricing/${customerId}`);
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
}
