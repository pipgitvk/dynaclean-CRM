import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    // ✅ 1. Authenticate
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ 2. Parse body
    const body = await req.json();
    const { customer_id, product_code } = body;

    if (!customer_id || !product_code) {
      return NextResponse.json(
        { error: "customer_id and product_code are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // ✅ 3. Get product_id from product_code
    const [productRows] = await conn.execute(
      `SELECT id, price_per_unit, gst_rate 
       FROM products_list 
       WHERE item_code = ? 
       LIMIT 1`,
      [product_code]
    );

    if (productRows.length === 0) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const product = productRows[0];

    // ✅ 4. Check special price
    const [specialRows] = await conn.execute(
      `SELECT special_price, status
       FROM special_price
       WHERE customer_id = ? 
       AND product_id = ?
       AND status = 'approved'
       LIMIT 1`,
      [customer_id, product.id]
    );

    let finalPrice = product.price_per_unit;
    let specialPrice = null;

    if (specialRows.length > 0) {
      specialPrice = specialRows[0].special_price;
      finalPrice = specialPrice;
    }

    return NextResponse.json({
      success: true,
      product_id: product.id,
      original_price: product.price_per_unit,
      special_price: specialPrice,
      final_price: finalPrice,
      gst_rate: product.gst_rate,
    });

  } catch (err) {
    console.error("❌ Special price check failed:", err);

    return NextResponse.json(
      { error: "Special price check failed" },
      { status: 500 }
    );
  }
}
