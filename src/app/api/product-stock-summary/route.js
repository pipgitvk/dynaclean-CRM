

import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn = await getDbConnection();

  const [rows] = await conn.execute(`
    SELECT 
      ps.product_code,
      pl.item_name,
      pl.product_number, 
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
      ps.added_by,
      ps.supporting_file,
      ps.godown,
      ps.total,
      ps.delhi,
      ps.south,
      ps.stock_status
    FROM product_stock ps
    LEFT JOIN product_stock_summary pss ON ps.product_code = pss.product_code
    LEFT JOIN products_list pl ON ps.product_code = pl.item_code
    ORDER BY ps.updated_at DESC
  `);

      // await conn.end();
  // console.log("these aare the rows", rows);
  
  console.log("All product_stock data fetched with summary:", rows.length, "records found");

  return Response.json(rows);
}