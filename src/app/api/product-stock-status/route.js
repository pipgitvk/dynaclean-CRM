

import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn = await getDbConnection();

  const [rows] = await conn.execute(`
    SELECT 
      ps.product_code,
      pl.item_name,  -- Added item_name
      pl.product_number, 
      pl.min_qty,
      ps.quantity,
      ps.net_amount,
      ps.note,
      ps.location,
      ps.updated_at,
      ps.from_company,
      ps.gst,
      ps.hs_code,
      ps.to_company,
      ps.delivery_address,
      pss.total_quantity,
      ps.added_by,
      ps.supporting_file,
      ps.stock_status
    FROM product_stock ps
    INNER JOIN (
      SELECT product_code, MAX(updated_at) AS latest_update
      FROM product_stock
      GROUP BY product_code
    ) latest_ps ON ps.product_code = latest_ps.product_code AND ps.updated_at = latest_ps.latest_update
    LEFT JOIN product_stock_summary pss ON ps.product_code = pss.product_code
    LEFT JOIN products_list pl ON ps.product_code = pl.item_code -- Join to get item_name and product_number
    ORDER BY ps.updated_at DESC
  `);

      // await conn.end();
  console.log("Stock status data fetched successfully:", rows.length, "records found");
  
  return Response.json(rows);
}