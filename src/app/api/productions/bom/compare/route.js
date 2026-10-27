import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/productions/bom/compare?production_id=ID
// Returns current production BOM snapshot items and current active BOM items for that product.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const pid = Number(searchParams.get("production_id"));
    if (!pid) return NextResponse.json({ error: "Missing production_id" }, { status: 400 });

    const db = await getDbConnection();

    const [[prod]] = await db.query(
      `SELECT pr.id as production_id, pr.product_code, pr.items_json,
              pr.expected_date, pr.status, pr.progress_percent,
              pr.created_at, pr.updated_at, pr.created_by,
              p.item_name as product_name, p.product_image
         FROM production pr
         JOIN products_list p ON p.item_code = pr.product_code
        WHERE pr.id = ?
        LIMIT 1`,
      [pid]
    );
    if (!prod) return NextResponse.json({ error: "Production not found" }, { status: 404 });

    // Snapshot currently stored on production row
    let currentItemsRaw = [];
    try {
      currentItemsRaw = prod.items_json ? JSON.parse(prod.items_json || "[]") : [];
    } catch {
      currentItemsRaw = [];
    }

    // Load active BOM for comparison
    const [[bomRow]] = await db.query(
      `SELECT id as bom_id, items_json, created_by, modified_by
         FROM bom
        WHERE product_code = ? AND status = 'active'
        LIMIT 1`,
      [prod.product_code]
    );
    let bomItemsRaw = [];
    if (bomRow) {
      try {
        bomItemsRaw = JSON.parse(bomRow.items_json || "[]");
      } catch {
        bomItemsRaw = [];
      }
    }

    // Enrich items with spare details
    const allSpareIds = Array.from(
      new Set(
        [...currentItemsRaw, ...bomItemsRaw]
          .map(it => Number(it.spare_id))
          .filter(Boolean)
      )
    );

    let spareMap = new Map();
    if (allSpareIds.length) {
      const placeholders = allSpareIds.map(() => "?").join(",");
      const [spares] = await db.execute(
        `SELECT id, item_name, image, specification FROM spare_list WHERE id IN (${placeholders})`,
        allSpareIds
      );
      spareMap = new Map(spares.map(s => [Number(s.id), s]));
    }

    function normalizeItems(list) {
      return (list || []).map(it => {
        const s = spareMap.get(Number(it.spare_id)) || {};
        const qty = it.qty_in_product ?? it.qty ?? 0;
        const weight = it.weight_percent ?? it.weight ?? 0;
        return {
          spare_id: Number(it.spare_id),
          spare_name: it.spare_name || s.item_name || "",
          spare_image: it.spare_image || s.image || null,
          specification: it.spec || it.specification || s.specification || "",
          qty_in_product: Number(qty) || 0,
          weight_percent: Number(weight) || 0,
        };
      });
    }

    const current_items = normalizeItems(currentItemsRaw);
    const bom_items = normalizeItems(bomItemsRaw);

    return NextResponse.json({
      header: {
        production_id: prod.production_id,
        product_code: prod.product_code,
        product_name: prod.product_name,
        product_image: prod.product_image,
        expected_date: prod.expected_date,
        status: prod.status,
        progress_percent: prod.progress_percent,
        created_at: prod.created_at,
        updated_at: prod.updated_at,
        created_by: prod.created_by,
      },
      bom: {
        bom_id: bomRow?.bom_id || null,
        created_by: bomRow?.created_by || null,
        modified_by: bomRow?.modified_by || null,
      },
      current_items,
      bom_items,
    });
  } catch (e) {
    console.error("/api/productions/bom/compare GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/productions/bom/compare
// Body: { production_id, spare_ids?: number[] }
// Effect: sync selected spares in production.items_json with current active BOM for that product,
// ensuring required qty is at least already issued for each updated spare.
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { production_id, spare_ids } = await req.json();
    const pid = Number(production_id) || 0;
    if (!pid) return NextResponse.json({ error: "production_id required" }, { status: 400 });

    // Normalize spare_ids to a Set of numbers; if missing/empty, nothing to do
    const ids = Array.isArray(spare_ids)
      ? Array.from(new Set(spare_ids.map((x) => Number(x)).filter((x) => x > 0)))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ success: true, message: "No items selected" });
    }

    const db = await getDbConnection();
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      const [[prod]] = await conn.query(
        `SELECT id, product_code, items_json FROM production WHERE id = ? LIMIT 1`,
        [pid]
      );
      if (!prod) {
        await conn.rollback();
        return NextResponse.json({ error: "Production not found" }, { status: 404 });
      }

      const product_code = prod.product_code;

      const [[bomRow]] = await conn.query(
        `SELECT items_json FROM bom WHERE product_code = ? AND status = 'active' LIMIT 1`,
        [product_code]
      );
      if (!bomRow) {
        await conn.rollback();
        return NextResponse.json({ error: "Active BOM not found for this product" }, { status: 400 });
      }

      let bomItems = [];
      try {
        bomItems = JSON.parse(bomRow.items_json || "[]");
      } catch {
        bomItems = [];
      }
      if (!Array.isArray(bomItems) || bomItems.length === 0) {
        await conn.rollback();
        return NextResponse.json({ error: "Active BOM has no items" }, { status: 400 });
      }

      // Parse current snapshot from production (baseline)
      let currentItems = [];
      try {
        currentItems = prod.items_json ? JSON.parse(prod.items_json || "[]") : [];
      } catch {
        currentItems = [];
      }

      const currentMap = new Map(
        currentItems.map((it) => [Number(it.spare_id), { ...it }])
      );
      const bomMap = new Map(
        bomItems.map((it) => [Number(it.spare_id), { ...it }])
      );

      // issued qty per spare for this production
      const [usage] = await conn.execute(
        `SELECT spare_id, COALESCE(SUM(qty_used),0) as used
           FROM bom_transaction
          WHERE production_id = ?
          GROUP BY spare_id`,
        [pid]
      );
      const usedMap = new Map(
        (usage || []).map((r) => [Number(r.spare_id), Number(r.used || 0)])
      );

      // For each selected spare_id, update or add snapshot entry based on BOM,
      // ensuring required qty >= already used.
      for (const sid of ids) {
        const bomIt = bomMap.get(sid);
        if (!bomIt) continue; // nothing to update if not in current BOM

        const used = usedMap.get(sid) || 0;
        const rawReq = Number(bomIt.qty_in_product ?? bomIt.qty ?? 0) || 0;
        const safeReq = Math.max(rawReq, used);

        const existing = currentMap.get(sid) || {};
        currentMap.set(sid, {
          ...existing,
          ...bomIt,
          qty_in_product: safeReq,
        });
      }

      const newSnapshot = Array.from(currentMap.values());

      await conn.execute(
        `UPDATE production SET items_json = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(newSnapshot), pid]
      );

      await conn.commit();
      return NextResponse.json({ success: true });
    } catch (e) {
      await conn.rollback();
      console.error("/api/productions/bom/compare POST error", e);
      return NextResponse.json({ error: e.message || "Failed" }, { status: 400 });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("/api/productions/bom/compare POST outer error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
