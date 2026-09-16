import { getDbConnection } from "@/lib/db";
import {
  getAccessoryStockMap,
  resolveProductCodes,
} from "@/lib/resolveAccessorySpareId";

export async function POST(req) {
  try {
    const { godown, accessories, product_code } = await req.json();

    if (!Array.isArray(accessories) || accessories.length === 0) {
      return new Response(
        JSON.stringify({ error: "accessories array is required" }),
        { status: 400 },
      );
    }

    const conn = await getDbConnection();

    let rowsToCheck = accessories;

    if (product_code) {
      const productCodes = await resolveProductCodes(conn, product_code);
      const placeholders = productCodes.map(() => "?").join(", ");
      const [paRows] = await conn.execute(
        `SELECT id, spare_id, accessory_name, qty, product_code, package_status
         FROM product_accessories
         WHERE product_code IN (${placeholders})
           AND (package_status = 'available' OR package_status IS NULL)`,
        productCodes,
      );

      if (paRows.length > 0) {
        rowsToCheck = paRows;
      }
    }

    const stockMap = await getAccessoryStockMap(conn, rowsToCheck, godown);

    return new Response(JSON.stringify({ success: true, stockMap }), {
      status: 200,
    });
  } catch (error) {
    console.error("Accessory stock check error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
