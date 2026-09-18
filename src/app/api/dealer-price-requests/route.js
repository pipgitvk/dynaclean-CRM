import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  DEALER_PRICE_TERM_OPTIONS,
  DEALER_PRICE_TYPE,
  isDealerPriceType,
} from "@/lib/specialPriceDefaults";

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const customerId = Number(body.customer_id);
    const priceTerm = String(body.price_term || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customerId) {
      return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
    }

    if (!DEALER_PRICE_TERM_OPTIONS.includes(priceTerm)) {
      return NextResponse.json({ error: "Invalid price term" }, { status: 400 });
    }

    if (!items.length) {
      return NextResponse.json(
        { error: "Select at least one model" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();
    const username = payload.username || payload.name || "user";
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      const itemType = String(item.item_type || "").toLowerCase();
      const productId = Number(item.product_id);
      if (!["product", "spare"].includes(itemType) || !productId) continue;

      const [existing] = await conn.execute(
        `SELECT id, status, price_type, special_price
         FROM special_price
         WHERE customer_id = ? AND product_id = ? AND item_type = ?
         LIMIT 1`,
        [customerId, productId, itemType],
      );

      if (existing.length > 0) {
        const row = existing[0];
        const status = String(row.status || "").toLowerCase();
        const isPendingDealer =
          isDealerPriceType(row.price_type) &&
          status === "pending" &&
          Number(row.special_price || 0) === 0;

        if (isPendingDealer || status === "approved") {
          skipped += 1;
          continue;
        }

        await conn.execute(
          `UPDATE special_price
           SET special_price = 0,
               price_type = ?,
               price_term = ?,
               status = 'pending',
               set_by = ?,
               set_date = NOW(),
               approved_by = NULL,
               approved_date = NULL,
               product_code = COALESCE(?, product_code)
           WHERE id = ?`,
          [
            DEALER_PRICE_TYPE,
            priceTerm,
            username,
            item.product_code ? String(item.product_code) : null,
            row.id,
          ],
        );
        created += 1;
        continue;
      }

      await conn.execute(
        `INSERT INTO special_price (
          customer_id, item_type, product_id, product_code,
          special_price, price_type, price_term, status, set_by, set_date
        ) VALUES (?, ?, ?, ?, 0, ?, ?, 'pending', ?, NOW())`,
        [
          customerId,
          itemType,
          productId,
          item.product_code ? String(item.product_code) : null,
          DEALER_PRICE_TYPE,
          priceTerm,
          username,
        ],
      );
      created += 1;
    }

    if (created === 0) {
      return NextResponse.json({
        success: false,
        error: "No new models added. Request may already exist.",
        skipped,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Dealer price request submitted for ${created} model(s)`,
      created,
      skipped,
    });
  } catch (error) {
    console.error("❌ dealer-price-requests POST:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit request" },
      { status: 500 },
    );
  }
}
