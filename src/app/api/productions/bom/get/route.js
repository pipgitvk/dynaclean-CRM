// src/app/api/productions/bom/get/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/productions/bom/get?product_code=XXX or ?id=123
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const product_code = (searchParams.get("product_code") || "").trim();
    const idParam = searchParams.get("id");

    const db = await getDbConnection();

    let row = null;
    if (product_code) {
      const [rows] = await db.execute(`SELECT id, product_code, items_json, created_by, modified_by FROM bom WHERE product_code = ? LIMIT 1`, [product_code]);
      row = rows[0] || null;
    } else if (idParam) {
      const id = Number(idParam);
      const [rows] = await db.execute(`SELECT id, product_code, items_json, created_by, modified_by FROM bom WHERE id = ? LIMIT 1`, [id]);
      row = rows[0] || null;
    } else {
      return NextResponse.json({ error: "product_code or id is required" }, { status: 400 });
    }

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Product meta
    const [[product]] = await db.execute(
      `SELECT item_name, product_image, specification FROM products_list WHERE item_code = ? LIMIT 1`,
      [row.product_code]
    );

    // Parse items and enrich with spare details
    let items = [];
    try { items = JSON.parse(row.items_json || "[]"); } catch { items = []; }

    const spareIds = Array.from(new Set(items.map(it => Number(it.spare_id)).filter(Boolean)));
    let spareMap = new Map();
    if (spareIds.length) {
      const placeholders = spareIds.map(()=>"?").join(",");
      const [spares] = await db.execute(
        `SELECT id, item_name, image, specification FROM spare_list WHERE id IN (${placeholders})`,
        spareIds
      );
      spareMap = new Map(spares.map(s => [Number(s.id), s]));
    }

    // Availability from stock_summary for all BOM spares
    let stockMap = new Map();
    if (spareIds.length) {
      const placeholders2 = spareIds.map(()=>"?").join(",");
      const [stockRows] = await db.execute(
        `SELECT spare_id, total_quantity AS total, Delhi AS delhi, South AS south FROM stock_summary WHERE spare_id IN (${placeholders2})`,
        spareIds
      );
      stockMap = new Map(
        stockRows.map(r => [
          Number(r.spare_id),
          {
            total: Number(r.total || 0),
            delhi: Number(r.delhi || 0),
            south: Number(r.south || 0),
          },
        ])
      );
    }

    const normItems = items.map((it) => {
      const s = spareMap.get(Number(it.spare_id)) || {};
      const st = stockMap.get(Number(it.spare_id)) || {};
      // Normalize qty/weight keys
      const qty = it.qty_in_product ?? it.qty ?? 0;
      const weight = it.weight_percent ?? it.weight ?? 0;
      return {
        spare_id: it.spare_id,
        spare_name: it.spare_name || s.item_name || "",
        spare_image: it.spare_image || s.image || null,
        specification: it.spec || it.specification || s.specification || "",
        qty_in_product: Number(qty) || 0,
        weight_percent: Number(weight) || 0,
        total_available: typeof st.total === "number" ? st.total : 0,
        delhi_available: typeof st.delhi === "number" ? st.delhi : 0,
        south_available: typeof st.south === "number" ? st.south : 0,
      };
    });

    return NextResponse.json({
      id: row.id,
      product_code: row.product_code,
      created_by: row.created_by || null,
      modified_by: row.modified_by || null,
      product: product || null,
      items: normItems,
    });
  } catch (e) {
    console.error("GET /productions/bom/get error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
