import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDbConnection();

    // Low stock: total_quantity <= min_qty (and min_qty > 0)
    const [lowStockRows] = await db.execute(`
      SELECT
        pss.product_code,
        pl.item_name,
        pl.product_number,
        pl.min_qty,
        pl.product_image,
        pss.total_quantity,
        pss.Delhi  AS delhi,
        pss.South  AS south,
        pss.updated_at
      FROM product_stock_summary pss
      LEFT JOIN products_list pl ON pss.product_code = pl.item_code
      WHERE pss.total_quantity <= pl.min_qty
        AND pl.min_qty > 0
      ORDER BY pss.total_quantity ASC
    `);

    // Zero stock: total_quantity = 0  (or negative, treated as 0)
    const [zeroStockRows] = await db.execute(`
      SELECT
        pss.product_code,
        pl.item_name,
        pl.product_number,
        pl.min_qty,
        pl.product_image,
        pss.total_quantity,
        pss.Delhi  AS delhi,
        pss.South  AS south,
        pss.updated_at
      FROM product_stock_summary pss
      LEFT JOIN products_list pl ON pss.product_code = pl.item_code
      WHERE pss.total_quantity <= 0
      ORDER BY pl.item_name ASC
    `);

    // Fetch latest shipments for each product with future expected dates only
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [shipments] = await db.execute(`
      SELECT 
        id,
        product_code,
        item_name,
        qty,
        expected_arrival_date,
        status,
        created_at
      FROM incoming_shipments
      WHERE status IN ('Order Preparing', 'In Transit', 'Out for Delivery')
        AND DATE(expected_arrival_date) >= CURDATE()
      ORDER BY created_at DESC
    `);

    // Create a map of latest shipment per product
    const latestShipmentMap = {};
    for (const shipment of shipments) {
      const key = shipment.product_code || shipment.item_name?.toLowerCase();
      if (key && !latestShipmentMap[key]) {
        latestShipmentMap[key] = {
          expected_arrival_date: shipment.expected_arrival_date,
          qty: shipment.qty,
          status: shipment.status
        };
      }
    }

    // Merge shipment data into stock rows
    const addShipmentData = (rows) => {
      return rows.map(row => {
        const key = row.product_code || row.item_name?.toLowerCase();
        const shipment = latestShipmentMap[key];
        return {
          ...row,
          latest_shipment_qty: shipment?.qty || null,
          latest_shipment_expected_date: shipment?.expected_arrival_date || null,
          latest_shipment_status: shipment?.status || null
        };
      });
    };

    return NextResponse.json({
      lowStock: addShipmentData(lowStockRows),
      zeroStock: addShipmentData(zeroStockRows),
      lowStockCount: lowStockRows.length,
      zeroStockCount: zeroStockRows.length,
    });
  } catch (error) {
    console.error("Failed to fetch low/zero stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock alerts" }, { status: 500 });
  }
}
