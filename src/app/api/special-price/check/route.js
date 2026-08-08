import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getApprovedSpecialPrice } from "@/lib/getApprovedSpecialPrice";

function normCode(value) {
  return String(value ?? "").trim();
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const customerId = String(body.customer_id ?? "").trim();
    const productCodeInput = normCode(body.product_code);

    if (!customerId || !productCodeInput) {
      return NextResponse.json(
        { error: "customer_id and product_code are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const codeLower = productCodeInput.toLowerCase();

    const [productRows] = await conn.execute(
      `SELECT id, item_code, price_per_unit, gst_rate
       FROM products_list
       WHERE LOWER(TRIM(item_code)) = ?
          OR LOWER(TRIM(COALESCE(product_number, ''))) = ?
       LIMIT 1`,
      [codeLower, codeLower]
    );

    const product = productRows[0] || null;
    const productId = product?.id ?? null;
    const resolvedCode = product?.item_code ?? productCodeInput;

    const specialPrice = await getApprovedSpecialPrice(
      conn,
      customerId,
      productId,
      resolvedCode
    );

    const originalPrice =
      product?.price_per_unit != null ? Number(product.price_per_unit) : null;

    const finalPrice =
      specialPrice != null && Number.isFinite(specialPrice)
        ? specialPrice
        : originalPrice;

    if (product == null && specialPrice == null) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      product_id: productId,
      product_code: resolvedCode,
      original_price: originalPrice,
      special_price: specialPrice,
      final_price: finalPrice,
      gst_rate: product?.gst_rate ?? null,
      has_special_price: specialPrice != null && Number.isFinite(specialPrice),
    });
  } catch (err) {
    console.error("❌ Special price check failed:", err);

    return NextResponse.json(
      { error: "Special price check failed" },
      { status: 500 }
    );
  }
}
