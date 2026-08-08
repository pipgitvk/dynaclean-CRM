



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
import {
  getApprovedSpecialPrice,
  resolveQuotationItemByCode,
} from "@/lib/getApprovedSpecialPrice";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  const mode = searchParams.get("mode") || "full"; // 'suggestion' or 'full'
  const customerId = searchParams.get("customerId")?.trim() || "";

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
      // Full product fetch (exact code, then case-insensitive item_code / product_number)
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
          p.product_image as image_path,
          'product' AS item_type
        FROM
          products_list p
        LEFT JOIN
          product_images pi ON p.item_code = pi.item_code
        WHERE
          p.item_code = ?
        LIMIT 1`,
        [code]
      );

      if (rows.length === 0) {
        const codeLower = code.toLowerCase();
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
            p.product_image as image_path,
            'product' AS item_type
          FROM
            products_list p
          LEFT JOIN
            product_images pi ON p.item_code = pi.item_code
          WHERE
            LOWER(TRIM(p.item_code)) = ?
            OR CAST(p.product_number AS CHAR) = ?
          LIMIT 1`,
          [codeLower, codeLower]
        );
      }

      if (rows.length === 0) {
        [rows] = await conn.execute(
          `
          SELECT
            T1.spare_number AS item_code,
            T1.item_name,
            '84798999' AS hsn_sac,
            T1.specification,
            'Nos' AS unit,
            COALESCE(T1.sale_price, T1.price) AS price_per_unit,
            T1.tax AS gst_rate,
            T1.last_negotiation_price,
            T1.image AS image_path,
            'spare' AS item_type
          FROM
            spare_list AS T1
          WHERE
            CAST(T1.spare_number AS CHAR) = ?
            OR LOWER(TRIM(CAST(T1.spare_number AS CHAR))) = ?
          LIMIT 1`,
          [code, code.toLowerCase()]
        );
      }
    }

    if (mode !== "suggestion" && customerId && rows.length > 0) {
      try {
        const row = rows[0];
        const quotationItem = await resolveQuotationItemByCode(
          conn,
          row.item_code || code
        );
        const specialPrice = await getApprovedSpecialPrice(
          conn,
          customerId,
          quotationItem?.itemId ?? null,
          quotationItem?.itemCode ?? row.item_code ?? code,
          quotationItem?.itemType ?? row.item_type ?? null
        );
        if (specialPrice != null) {
          rows[0] = {
            ...row,
            item_type: quotationItem?.itemType ?? row.item_type ?? "product",
            special_price: specialPrice,
            original_price: row.price_per_unit,
          };
        } else if (quotationItem?.itemType) {
          rows[0] = { ...row, item_type: quotationItem.itemType };
        }
      } catch (specialErr) {
        console.error("❌ Special price lookup skipped:", specialErr);
      }
    }

    console.log("Fetched rows:", rows);
    return new Response(JSON.stringify(rows), { status: 200 });
  } catch (err) {
    console.error("❌ Error fetching product:", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
    });
  }
}