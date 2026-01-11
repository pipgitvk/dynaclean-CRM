import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/productions/process/get?production_id=ID
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const pid = Number(searchParams.get("production_id"));
    if (!pid) return NextResponse.json({ error: "Missing production_id" }, { status: 400 });

    const db = await getDbConnection();

    const [[header]] = await db.query(
      `SELECT pr.id as production_id, pr.product_code, pr.expected_date, pr.status, pr.progress_percent,
              pr.created_at, pr.updated_at, pr.created_by,
              p.item_name as product_name, p.product_image,
              pr.items_json
         FROM production pr
         JOIN products_list p ON p.item_code = pr.product_code
        WHERE pr.id = ?
        LIMIT 1`,
      [pid]
    );
    if (!header) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Prefer BOM snapshot stored on the production row; fallback to current active BOM for legacy rows
    let bom_items = [];
    let bomId = null;
    if (header.items_json) {
      try {
        bom_items = JSON.parse(header.items_json || "[]");
      } catch {
        bom_items = [];
      }
    }
    if (!bom_items || bom_items.length === 0) {
      const [[bomRow]] = await db.query(
        `SELECT id as bom_id, items_json FROM bom WHERE product_code = ? AND status = 'active' LIMIT 1`,
        [header.product_code]
      );
      if (bomRow) {
        bomId = bomRow.bom_id;
        try {
          bom_items = JSON.parse(bomRow.items_json || "[]");
        } catch {
          bom_items = [];
        }
      }
    }

    // Enrich with spare names/images for UI
    const spareIds = Array.from(new Set(bom_items.map(it => Number(it.spare_id)).filter(Boolean)));
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

    const [usage] = await db.execute(
      `SELECT spare_id, SUM(qty_used) as used FROM bom_transaction WHERE production_id = ? GROUP BY spare_id`,
      [pid]
    );
    const usedMap = Object.fromEntries((usage || []).map(r => [String(r.spare_id), Number(r.used || 0)]));

    // compute progress
    let progress = 0;
    for (const it of bom_items) {
      const req = Number(it.qty_in_product ?? it.qty ?? 0) || 0;
      const w = Number(it.weight_percent ?? it.weight ?? 0) || 0;
      const used = Number(usedMap[String(it.spare_id)] || 0);
      const factor = req > 0 ? Math.min(used / req, 1) : 0;
      progress += w * factor;
    }
    progress = Math.max(0, Math.min(progress, 100));

    const items = bom_items.map(it => {
      const s = spareMap.get(Number(it.spare_id)) || {};
      const st = stockMap.get(Number(it.spare_id)) || {};
      return {
        ...it,
        spare_name: it.spare_name || s.item_name || undefined,
        spare_image: it.spare_image || s.image || undefined,
        specification: it.spec || it.specification || s.specification || undefined,
        used_qty: usedMap[String(it.spare_id)] || 0,
        total_available: typeof st.total === "number" ? st.total : 0,
        delhi_available: typeof st.delhi === "number" ? st.delhi : 0,
        south_available: typeof st.south === "number" ? st.south : 0,
      };
    });

    // transactions list
    const [tx] = await db.execute(
      `SELECT t.id, t.spare_id, t.qty_used, t.warehouse, t.assembly, t.created_at, t.created_by, s.item_name AS spare_name
       FROM bom_transaction t
       LEFT JOIN spare_list s ON s.id = t.spare_id
       WHERE t.production_id = ?
       ORDER BY t.created_at DESC`,
      [pid]
    );

    const { items_json, ...headerRest } = header;
    return NextResponse.json({ header: { ...headerRest, progress_percent: progress }, bom: { id: bomId, items }, transactions: tx });
  } catch (e) {
    console.error("/api/productions/process/get error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/productions/process/issue
// body: { production_id, product_code, spare_id, qty, warehouse, assembly }
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    const username = payload?.username || null;
    const { production_id, product_code, spare_id, qty, warehouse, assembly } = await req.json();
    const q = Number(qty) || 0;
    if (!production_id || !product_code || !spare_id || q < 1 || !warehouse) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const db = await getDbConnection();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Check availability from stock_summary
      const [[sumRow]] = await conn.query(
        `SELECT total_quantity AS total, Delhi, South FROM stock_summary WHERE spare_id = ? LIMIT 1`,
        [spare_id]
      );
      const isDelhi = /delhi/i.test(String(warehouse));
      const availableWh = isDelhi ? Number(sumRow?.Delhi || 0) : Number(sumRow?.South || 0);
      const availableTotal = Number(sumRow?.total || 0);
      if (q > availableWh || q > availableTotal) {
        throw new Error("Insufficient stock");
      }

      // Validate not exceeding required remain, based on BOM snapshot stored on production row.
      // For legacy rows without items_json, fallback to current active BOM.
      const [[prodRow]] = await conn.query(
        `SELECT items_json FROM production WHERE id = ? LIMIT 1`,
        [production_id]
      );
      let bomItems = [];
      if (prodRow?.items_json) {
        try {
          bomItems = JSON.parse(prodRow.items_json || '[]');
        } catch {
          bomItems = [];
        }
      }
      if (!bomItems || bomItems.length === 0) {
        const [[bomRow]] = await conn.query(
          `SELECT items_json FROM bom WHERE product_code = ? AND status = 'active' LIMIT 1`,
          [product_code]
        );
        bomItems = bomRow ? JSON.parse(bomRow.items_json || '[]') : [];
      }
      const reqItem = bomItems.find(it => Number(it.spare_id) === Number(spare_id));
      const requiredQty = Number(reqItem?.qty_in_product ?? reqItem?.qty ?? 0) || 0;
      const [[issuedRow]] = await conn.query(
        `SELECT COALESCE(SUM(qty_used),0) as issued FROM bom_transaction WHERE production_id = ? AND spare_id = ?`,
        [production_id, spare_id]
      );
      const alreadyIssued = Number(issuedRow?.issued || 0);
      const remain = Math.max(requiredQty - alreadyIssued, 0);
      if (q > remain) {
        throw new Error(`Cannot issue more than required. Remaining: ${remain}`);
      }

      // Insert bom_transaction
      await conn.execute(
        `INSERT INTO bom_transaction (production_id, product_code, spare_id, qty_used, warehouse, assembly, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [production_id, product_code, spare_id, q, warehouse, assembly || null, username]
      );

      // Baseline from last stock_list snapshot (like warehouse-in); fallback to summary if none
      const [lastRows] = await conn.execute(
        `SELECT total, delhi, south FROM stock_list WHERE spare_id = ? ORDER BY created_at DESC LIMIT 1`,
        [spare_id]
      );
      let baseTotal = 0, baseDelhi = 0, baseSouth = 0;
      if (lastRows.length > 0) {
        baseTotal = Number(lastRows[0].total) || 0;
        baseDelhi = Number(lastRows[0].delhi) || 0;
        baseSouth = Number(lastRows[0].south) || 0;
      } else {
        baseTotal = Number(sumRow?.total || 0);
        baseDelhi = Number(sumRow?.Delhi || 0);
        baseSouth = Number(sumRow?.South || 0);
      }
      const newDelhi = isDelhi ? baseDelhi - q : baseDelhi;
      const newSouth = isDelhi ? baseSouth : baseSouth - q;
      const newTotal = baseTotal - q;
      if (newDelhi < 0 || newSouth < 0 || newTotal < 0) throw new Error("Insufficient stock");

      // Insert OUT snapshot row into stock_list with updated balances (use same column casing as warehouse-in)
      await conn.execute(
        `INSERT INTO stock_list (
           spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, added_date, from_company,
           supporting_file, added_by, godown, total, Delhi, South, godown_location
         ) VALUES (?, ?, NULL, NULL, ?, NULL, 'OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          spare_id,
          q,
          `Production issue #${production_id}${assembly ? ' - ' + assembly : ''}`,
          new Date(),
          null,
          null,
          username,
          warehouse,
          newTotal,
          newDelhi,
          newSouth,
          null,
        ]
      );

      // Update stock_summary
      const newSumTotal = Number(sumRow?.total || 0) - q;
      let newSumDelhi = Number(sumRow?.Delhi || 0), newSumSouth = Number(sumRow?.South || 0);
      if (isDelhi) newSumDelhi -= q; else newSumSouth -= q;
      await conn.execute(
        `UPDATE stock_summary SET last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?, last_status = 'OUT', updated_at = NOW() WHERE spare_id = ?`,
        [q, newSumTotal, newSumDelhi, newSumSouth, spare_id]
      );

      // Recompute progress and update production row
      let progress = 0;
      for (const it of bomItems) {
        const req = Number(it.qty_in_product ?? it.qty ?? 0) || 0;
        const w = Number(it.weight_percent ?? it.weight ?? 0) || 0;
        const [[issuedEach]] = await conn.query(
          `SELECT COALESCE(SUM(qty_used),0) as issued FROM bom_transaction WHERE production_id = ? AND spare_id = ?`,
          [production_id, it.spare_id]
        );
        const used = Number(issuedEach?.issued || 0);
        const factor = req > 0 ? Math.min(used / req, 1) : 0;
        progress += w * factor;
      }
      progress = Math.max(0, Math.min(progress, 100));
      const newStatus = progress >= 100 ? 'completed' : (progress > 0 ? 'in_process' : 'planned');
      await conn.execute(`UPDATE production SET progress_percent = ?, status = ?, updated_at = NOW() WHERE id = ?`, [progress, newStatus, production_id]);

      await conn.commit();
      return NextResponse.json({ success: true, progress });
    } catch (e) {
      await conn.rollback();
      console.error("/api/productions/process/issue error", e);
      return NextResponse.json({ error: e.message || "Failed" }, { status: 400 });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("/api/productions/process/issue outer error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
