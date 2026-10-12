import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { product_code, from_godown, to_godown, quantity } = await req.json();

    if (!product_code || !from_godown || !to_godown || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "All fields are required and quantity must be positive" }, { status: 400 });
    }

    if (from_godown === to_godown) {
      return NextResponse.json({ error: "Source and destination godowns cannot be the same" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Get current stock from product_stock_summary
    const [currentStock] = await conn.execute(
      "SELECT total_quantity, Delhi, South FROM product_stock_summary WHERE product_code = ?",
      [product_code]
    );

    if (currentStock.length === 0) {
      return NextResponse.json({ error: "Product not found in stock" }, { status: 404 });
    }

    const stock = currentStock[0];
    const fromQuantity = from_godown === "Delhi" ? stock.Delhi : stock.South;
    
    if (fromQuantity < quantity) {
      return NextResponse.json({ error: `Insufficient stock in ${from_godown} godown. Available: ${fromQuantity}` }, { status: 400 });
    }

    // Calculate new quantities
    let newDelhi = stock.Delhi;
    let newSouth = stock.South;

    if (from_godown === "Delhi") {
      newDelhi -= quantity;
      newSouth += quantity;
    } else {
      newSouth -= quantity;
      newDelhi += quantity;
    }

    // Update product_stock_summary
    await conn.execute(
      `UPDATE product_stock_summary 
       SET Delhi = ?, South = ?, last_status = 'TRANSFER', updated_at = NOW()
       WHERE product_code = ?`,
      [newDelhi, newSouth, product_code]
    );

    // Insert transfer record in product_stock table
    await conn.execute(
      `INSERT INTO product_stock 
        (product_code, quantity, stock_status, godown, total, delhi, south, added_by, added_date, note)
        VALUES (?, ?, 'TRANSFER', ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        product_code,
        quantity,
        `${to_godown} - Mundka`,
        stock.total_quantity,
        newDelhi,
        newSouth,
        payload.username || "Unknown",
        `Transfer: ${quantity} units from ${from_godown} to ${to_godown}`
      ]
    );

    // Log edit history to product_stock_edit_history table
    try {
      const oldDelhi = from_godown === "Delhi" ? stock.Delhi : stock.Delhi;
      const oldSouth = from_godown === "South" ? stock.South : stock.South;
      
      await conn.execute(
        `INSERT INTO product_stock_edit_history 
          (product_code, edited_by, old_delhi, new_delhi, old_south, new_south, change_description, edited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          product_code,
          payload.username || "Unknown",
          oldDelhi,
          newDelhi,
          oldSouth,
          newSouth,
          `Transfer: ${quantity} units from ${from_godown} to ${to_godown}`
        ]
      );
    } catch (historyError) {
      console.warn("Failed to log edit history:", historyError.message);
      // Continue anyway - don't fail the transfer if history logging fails
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully transferred ${quantity} units from ${from_godown} to ${to_godown}`,
      newDelhi,
      newSouth
    });

  } catch (error) {
    console.error("Stock transfer error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
