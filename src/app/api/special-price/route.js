import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = payload;
    const body = await req.json();
    const { customer_id, item_type, product_id, product_code, spare_id, price } = body;

    console.log("👉 [DEBUG] Received body:", body);

    if (!customer_id || !item_type || price === undefined || price === null) {
      return NextResponse.json(
        { error: "customer_id, item_type, and price are required" },
        { status: 400 }
      );
    }

    if (!["product", "spare"].includes(item_type)) {
      return NextResponse.json(
        { error: "item_type must be 'product' or 'spare'" },
        { status: 400 }
      );
    }

    if (item_type === "product" && !product_id) {
      return NextResponse.json({ error: "product_id is required for products" }, { status: 400 });
    }

    if (item_type === "spare" && !spare_id) {
      return NextResponse.json({ error: "spare_id is required for spares" }, { status: 400 });
    }

    // spare ka id bhi product_id column mein save hoga, item_type se differentiate hoga
    const itemId = item_type === "product" ? product_id : spare_id;
    const itemCode = item_type === "product" ? (product_code || null) : null;

    const conn = await getDbConnection();

    // Check for existing non-approved record
    const [existing] = await conn.execute(
      `SELECT id, status FROM special_price WHERE customer_id = ? AND product_id = ? AND item_type = ?`,
      [customer_id, itemId, item_type]
    );

    if (existing.length > 0) {
      const hasNonApproved = existing.some(
        (row) => (row.status || "").toLowerCase() !== "approved"
      );
      if (hasNonApproved) {
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          message: "Special price already exists in non-approved state; existing record kept as-is.",
        });
      }
    }

    // Insert — spare_id saved in product_id column
    const insertQuery = `
      INSERT INTO special_price 
      (customer_id, item_type, product_id, product_code, special_price, status, set_by, set_date)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, NOW())
    `;

    try {
      await conn.execute(insertQuery, [
        customer_id,
        item_type,
        itemId,
        itemCode,
        Number(price),
        username,
      ]);
    } catch (e) {
      if (e && e.code === "ER_DUP_ENTRY") {
        return NextResponse.json({
          success: true,
          alreadyExists: true,
          message: "Special price already exists for this customer and item.",
        });
      }
      throw e;
    }

    console.log(`✅ Special price created for ${item_type} by:`, username);

    return NextResponse.json({
      success: true,
      message: "Special price created. You can edit it from the Customer Special Prices table to send for approval.",
    });

  } catch (err) {
    console.error("❌ Special price creation failed:", err);
    return NextResponse.json({ error: "Special price creation failed" }, { status: 500 });
  }
}


export async function DELETE(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPERADMIN", "DIRECTOR"].includes(String(payload.role).toUpperCase())) {
      return NextResponse.json({ error: "Forbidden: Only admin can delete special price" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    const [existing] = await conn.execute(
      `SELECT id FROM special_price WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Special price not found" }, { status: 404 });
    }

    await conn.execute(`DELETE FROM special_price WHERE id = ?`, [id]);

    return NextResponse.json({ success: true, message: "Special price deleted successfully" });

  } catch (err) {
    console.error("❌ Special price deletion failed:", err);
    return NextResponse.json({ error: "Special price deletion failed" }, { status: 500 });
  }
}
