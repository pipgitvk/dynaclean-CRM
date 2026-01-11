// /api/stock/check-single-item/route.js
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  try {
    const { quote_number, godown, item_code } = await req.json();

    if (!quote_number || !godown || !item_code) {
      return new Response(JSON.stringify({ error: "Quote number, godown, and item_code are required" }), { status: 400 });
    }

    const conn = await getDbConnection();

    const locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";

    let stockResults = [];

    // Check if item_code contains alphabets
    const containsAlphabets = /[a-zA-Z]/.test(item_code);

    if (containsAlphabets) {
      // Case 1: Products
      const query = `
        SELECT
          T1.${locationColumn} AS stock_count,
          T2.min_qty,
          T2.item_name
        FROM product_stock_summary AS T1
        LEFT JOIN products_list AS T2 ON T1.product_code = T2.item_code
        WHERE T1.product_code = ?`;

      const [summary] = await conn.execute(query, [item_code]);

      if (summary.length > 0) {
        const result = summary[0];
        stockResults.push({
          item_code,
          item_name: result.item_name,
          stock_count: result.stock_count,
          min_qty: result.min_qty
        });
      } else {
        stockResults.push({ item_code, item_name: "N/A", stock_count: 0, min_qty: null });
      }
    } else {
      // Case 2: Spares
      const query = `
        SELECT
          T1.${locationColumn} AS stock_count,
          T2.min_qty,
          T2.item_name
        FROM stock_summary AS T1
        LEFT JOIN spare_list AS T2 ON T1.spare_id = T2.id
        WHERE T1.spare_id = ?`;

      const [summary] = await conn.execute(query, [item_code]);

      if (summary.length > 0) {
        const result = summary[0];
        stockResults.push({
          item_code,
          item_name: result.item_name,
          stock_count: result.stock_count,
          min_qty: result.min_qty
        });
      } else {
        stockResults.push({ item_code, item_name: "N/A", stock_count: 0, min_qty: null });
      }
    }

    if (stockResults.length > 0) {
      return new Response(JSON.stringify({ stockResults }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ stockResults: [], message: "No stock found for this item." }), { status: 200 });
    }
  } catch (error) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
