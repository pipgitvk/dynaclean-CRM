import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";

/* =========================
   UPDATE SPECIAL PRICE
========================= */
export async function updateSpecialPrice(formData) {
  "use server";

  const customerId = formData.get("customer_id");
  const productId = formData.get("product_id");
  const specialPrice = formData.get("special_price");

  if (!customerId || !productId) return;

  const conn = await getDbConnection();

  await conn.execute(
    `
    UPDATE special_price
    SET special_price = ?
    WHERE customer_id = ? AND product_id = ?
    `,
    [Number(specialPrice), Number(customerId), Number(productId)]
  );

  redirect(`/user-dashboard/special-pricing/${customerId}`);
}

/* =========================
   DELETE SPECIAL PRICE
========================= */
export async function deleteSpecialPrice(formData) {
  "use server";

  const customerId = formData.get("customer_id");
  const productId = formData.get("product_id");

  if (!customerId || !productId) return;

  const conn = await getDbConnection();

  await conn.execute(
    `
    DELETE FROM special_price
    WHERE customer_id = ? AND product_id = ?
    `,
    [Number(customerId), Number(productId)]
  );

  redirect(`/user-dashboard/special-pricing`);
}
