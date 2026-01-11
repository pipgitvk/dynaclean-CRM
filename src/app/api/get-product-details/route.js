



// // app/api/get-product-details/route.js
// import { getDbConnection } from "@/lib/db";
// import { log } from "console";

// export const dynamic = "force-dynamic";

// export async function GET(req) {
//   const { searchParams } = new URL(req.url);
//   const code = searchParams.get("code")?.trim();
//   const mode = searchParams.get("mode") || "full"; // 'suggestion' or 'full'

//   if (!code) {
//     return new Response(JSON.stringify({ error: "Missing product code" }), {
//       status: 400,
//     });
//   }

//   try {
//     const conn = await getDbConnection();
//     let rows;

//     if (mode === "suggestion") {
//       const likeCode = `%${code}%`;
//       [rows] = await conn.execute(
//         `SELECT p.item_code, p.item_name, pi.image_path
//          FROM products_list p
//          LEFT JOIN product_images pi ON p.item_code = pi.item_code
//          WHERE p.item_code LIKE ? OR p.item_name LIKE ?
//          LIMIT 10`,
//         [likeCode, likeCode]
//       );
//     } else {
//       // Full product fetch
//       [rows] = await conn.execute(
//         `SELECT p.item_code, p.item_name, p.hsn_sac, p.specification, p.unit, p.price_per_unit, p.gst_rate, pi.image_path
//          FROM products_list p
//          LEFT JOIN product_images pi ON p.item_code = pi.item_code
//          WHERE p.item_code = ?
//          LIMIT 1`,
//         [code]
//       );
//     }

//         // await conn.end();
//     console.log("Fetched rows:", rows);
//     return new Response(JSON.stringify(rows), { status: 200 });
//   } catch (err) {
//     console.error("❌ Error fetching product:", err);
//     return new Response(JSON.stringify({ error: "Server error" }), {
//       status: 500,
//     });
//   }
// }




// app/api/get-product-details/route.js
import { getDbConnection } from "@/lib/db";
import { log } from "console";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  const mode = searchParams.get("mode") || "full"; // 'suggestion' or 'full'

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing product code" }), {
      status: 400,
    });
  }

  try {
    const conn = await getDbConnection();
    let rows;

    if (mode === "suggestion") {
      const likeCode = `%${code}%`;
      // Fetch suggestions from both tables
      [rows] = await conn.execute(
        `
        (SELECT
          p.item_code,
          p.item_name,
          p.product_image as image_path,
          'product' AS source
        FROM
          products_list p
        LEFT JOIN
          product_images pi ON p.item_code = pi.item_code
        WHERE
          p.item_code LIKE ? OR p.item_name LIKE ?)
        UNION
        (SELECT
          sl.spare_number AS item_code,
          sl.item_name,
          sl.image AS image_path,
          'spare' AS source
        FROM
          spare_list sl
        WHERE
          sl.spare_number LIKE ? OR sl.item_name LIKE ?)
        LIMIT 10`,
        [likeCode, likeCode, likeCode, likeCode]
      );
    } else {
      // Full product fetch
      // First, try to get the product from the products_list table
      [rows] = await conn.execute(
        `
        SELECT
          p.item_code,
          p.item_name,
          p.hsn_sac,
          p.specification,
          p.unit,
          p.price_per_unit,
          p.gst_rate,
          p.last_negotiation_price,
          p.product_image as image_path
        FROM
          products_list p
        LEFT JOIN
          product_images pi ON p.item_code = pi.item_code
        WHERE
          p.item_code = ?
        LIMIT 1`,
        [code]
      );

      // If no product is found, try to get it from the spare_list table
      if (rows.length === 0) {
        [rows] = await conn.execute(
          `
          SELECT
            T1.id AS item_code,
            T1.item_name,
            '84798999' AS hsn_sac,
            T1.specification,
            'Nos' AS unit,
            T1.price AS price_per_unit,
            T1.tax AS gst_rate,
            T1.last_negotiation_price,
            T1.image AS image_path
          FROM
            spare_list AS T1
          WHERE
            T1.spare_number = ?
          LIMIT 1`,
          [code]
        );
      }
    }

    // await conn.end();
    console.log("Fetched rows:", rows);
    return new Response(JSON.stringify(rows), { status: 200 });
  } catch (err) {
    console.error("❌ Error fetching product:", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
    });
  }
}