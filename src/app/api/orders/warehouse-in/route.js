import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "warehouse_in", resource_type: "image" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const order_id  = formData.get("order_id");
    const wh_date   = formData.get("warehouse_in_date");
    const imageFile = formData.get("image");

    if (!order_id)   return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    if (!imageFile)  return NextResponse.json({ error: "Image is required" }, { status: 400 });

    const imageUrl = await uploadToCloudinary(imageFile);
    const conn = await getDbConnection();

    // Ensure columns exist (safe to run repeatedly)
    for (const col of [
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS warehouse_in_done TINYINT(1) DEFAULT 0",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS warehouse_in_date DATE NULL",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS warehouse_in_image VARCHAR(500) NULL",
      "ALTER TABLE neworder ADD COLUMN IF NOT EXISTS warehouse_in_by VARCHAR(100) NULL",
    ]) {
      await conn.execute(col).catch(() => {});
    }

    // 1. Fetch order
    const [orderRows] = await conn.execute(
      "SELECT is_returned, return_booking_done FROM neworder WHERE order_id = ?",
      [order_id]
    );
    if (!orderRows.length) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // 2. Fetch credit note linked to this order
    const [cnRows] = await conn.execute(
      "SELECT id, items FROM credit_notes WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
      [order_id]
    );
    if (!cnRows.length) return NextResponse.json({ error: "No credit note found for this order" }, { status: 404 });

    let items = cnRows[0].items;
    if (typeof items === "string") {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!items || !items.length) return NextResponse.json({ error: "Credit note has no items" }, { status: 400 });

    // 3. For each item → increase product_stock & product_stock_summary
    for (const item of items) {
      const product_code = item.item_code || item.product_code || item.code;
      const qty = Number(item.qty || item.quantity || item.return_qty || 0);

      if (!product_code || qty <= 0) continue;

      // Get latest stock snapshot
      const [lastRows] = await conn.execute(
        `SELECT total, delhi, south FROM product_stock
         WHERE product_code = ?
         ORDER BY created_at DESC LIMIT 1`,
        [product_code]
      );

      const prev     = lastRows[0] || { total: 0, delhi: 0, south: 0 };
      const newTotal = (Number(prev.total) || 0) + qty;
      const newDelhi = (Number(prev.delhi) || 0) + qty; // returned stock → Delhi by default
      const newSouth = Number(prev.south) || 0;

      // Insert new IN row
      await conn.execute(
        `INSERT INTO product_stock
           (product_code, quantity, note, stock_status, added_by, added_date, total, delhi, south)
         VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, ?)`,
        [
          product_code,
          qty,
          `Return Warehouse-In | Order: ${order_id}`,
          payload.username,
          wh_date || new Date().toISOString().split("T")[0],
          newTotal,
          newDelhi,
          newSouth,
        ]
      );

      // Update or insert summary
      const [summaryRows] = await conn.execute(
        "SELECT total_quantity, Delhi, South FROM product_stock_summary WHERE product_code = ?",
        [product_code]
      );

      if (summaryRows.length > 0) {
        await conn.execute(
          `UPDATE product_stock_summary
             SET last_updated_quantity = ?,
                 total_quantity = total_quantity + ?,
                 Delhi = Delhi + ?,
                 last_status = 'IN',
                 updated_at = NOW()
             WHERE product_code = ?`,
          [qty, qty, qty, product_code]
        );
      } else {
        await conn.execute(
          `INSERT INTO product_stock_summary
             (product_code, last_updated_quantity, total_quantity, Delhi, South, last_status)
           VALUES (?, ?, ?, ?, 0, 'IN')`,
          [product_code, qty, qty, qty]
        );
      }
    }

    // 4. Mark order warehouse_in done + set is_returned = 1 (Fully Returned)
    await conn.execute(
      `UPDATE neworder
         SET warehouse_in_done = 1,
             warehouse_in_date = ?,
             warehouse_in_image = ?,
             warehouse_in_by = ?,
             is_returned = 1
       WHERE order_id = ?`,
      [
        wh_date || new Date().toISOString().split("T")[0],
        imageUrl,
        payload.username,
        order_id,
      ]
    );

    return NextResponse.json({ success: true, message: "Warehouse-In done. Stock updated." });
  } catch (err) {
    console.error("[warehouse-in POST]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
