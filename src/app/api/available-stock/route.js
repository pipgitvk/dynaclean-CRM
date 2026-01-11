import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn = await getDbConnection();

  const [rows] = await conn.execute(`
    SELECT
      pss.product_code,
      pl.product_image,
      pl.item_name,
      pss.total_quantity as total,
      pss.Delhi as delhi,
      pss.South as south,
      pss.updated_at,
      ps.location as location
    FROM product_stock_summary pss
    LEFT JOIN products_list pl 
        ON pss.product_code = pl.item_code
    LEFT JOIN product_stock ps 
        ON ps.id = (
            SELECT id
            FROM product_stock ps2
            WHERE ps2.product_code = pss.product_code
              AND ps2.stock_status = 'in'
            ORDER BY ps2.updated_at DESC
            LIMIT 1
        )
    ORDER BY pss.updated_at DESC
  `);

  console.log("Available stock data fetched successfully:", rows.length, "records found");

  return Response.json(rows);
}
