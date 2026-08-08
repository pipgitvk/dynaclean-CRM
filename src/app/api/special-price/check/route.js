import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  getApprovedSpecialPrice,
  resolveProductByCode,
} from "@/lib/getApprovedSpecialPrice";

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
    const product = await resolveProductByCode(conn, productCodeInput);

    let originalPrice = null;
    let gstRate = null;
    if (product?.productId) {
      const [productRows] = await conn.execute(
        `SELECT price_per_unit, gst_rate FROM products_list WHERE id = ? LIMIT 1`,
        [product.productId]
      );
      if (productRows[0]) {
        originalPrice =
          productRows[0].price_per_unit != null
            ? Number(productRows[0].price_per_unit)
            : null;
        gstRate = productRows[0].gst_rate ?? null;
      }
    }

    const resolvedCode = product?.itemCode ?? productCodeInput;
    const specialPrice = await getApprovedSpecialPrice(
      conn,
      customerId,
      product?.productId ?? null,
      resolvedCode
    );

    if (product == null && specialPrice == null) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const finalPrice =
      specialPrice != null && Number.isFinite(specialPrice)
        ? specialPrice
        : originalPrice;

    return NextResponse.json({
      success: true,
      product_id: product?.productId ?? null,
      product_code: resolvedCode,
      original_price: originalPrice,
      special_price: specialPrice,
      final_price: finalPrice,
      gst_rate: gstRate,
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
