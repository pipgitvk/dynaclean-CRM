import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import PIN_ZONES from "@/lib/pincodeZones";

// -------------------------
// HELPERS
// -------------------------
function normalizePin(pin = "") {
  return String(pin).trim();
}

function getZoneForPin(pin) {
  const z = PIN_ZONES.find((entry) => {
    if (entry.type === "prefix") return entry.match.some((p) => pin.startsWith(p));
    return false;
  });
  return z || { zone: "Other", baseDays: 5 };
}

// -------------------------
// MAIN API
// -------------------------
export async function POST(req) {
  try {
    const body = await req.json();
    const { item_code, pincode, godown } = body || {};

    if (!item_code)
      return NextResponse.json({ error: "item_code is required" }, { status: 400 });

    if (!pincode)
      return NextResponse.json({ error: "pincode is required" }, { status: 400 });

    const pin = normalizePin(pincode);
    const zoneData = getZoneForPin(pin);

    const conn = await getDbConnection();

    // ---------------------------------------------------
    // STEP 1 — Check if product or spare
    // ---------------------------------------------------
    let isProduct = false;

    // Product check
    const [productMatch] = await conn.execute(
      `SELECT item_code FROM products_list WHERE item_code = ? LIMIT 1`,
      [item_code]
    );

    if (productMatch.length) isProduct = true;

    // Spare check
    const [spareMatch] = await conn.execute(
      `SELECT spare_number FROM spare_list WHERE spare_number = ? LIMIT 1`,
      [item_code]
    );

    if (!productMatch.length && !spareMatch.length) {
      return NextResponse.json({
        available: false,
        godown: null,
        delivery_days: null,
        note: "Item not found in products or spares",
      });
    }

    // ---------------------------------------------------
    // STEP 2 — Determine table + column
    // ---------------------------------------------------
    const table = isProduct ? "product_stock_summary" : "stock_summary";

    // FIXED: Your spare stock table uses `spare_id`, not spare_number
    const idColumn = isProduct ? "product_code" : "spare_id";

    // If SPARE: spare_id is numeric but you search using spare_number
    // So map spare_number → spare_id
    let searchCode = item_code;

    if (!isProduct) {
      const [sid] = await conn.execute(
        `SELECT id FROM spare_list WHERE spare_number = ? LIMIT 1`,
        [item_code]
      );

      if (sid.length) {
        searchCode = sid[0].id; // use spare_id
      } else {
        return NextResponse.json({
          available: false,
          godown: null,
          delivery_days: null,
          note: "Spare not found",
        });
      }
    }

    // ---------------------------------------------------
    // STEP 3 — Pull stock
    // ---------------------------------------------------
    const [rows] = await conn.execute(
      `SELECT total_quantity AS total, delhi, south
       FROM ${table}
       WHERE ${idColumn} = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [searchCode]
    );

    if (!rows.length) {
      return NextResponse.json({
        available: false,
        godown: null,
        delivery_days: null,
        note: "No stock record found",
      });
    }

    const stock = rows[0];
    const delhiQty = Number(stock.delhi || 0);
    const southQty = Number(stock.south || 0);

    // ---------------------------------------------------
    // STEP 4 — Manual godown selection
    // ---------------------------------------------------
    if (godown) {
      if (godown === "Delhi - Mundka" && delhiQty > 0) {
        return NextResponse.json({
          available: true,
          godown,
          delivery_days: zoneData.baseDays,
        });
      }

      if (godown === "Tamil_Nadu - Coimbatore" && southQty > 0) {
        return NextResponse.json({
          available: true,
          godown,
          delivery_days: zoneData.baseDays,
        });
      }
    }

    // ---------------------------------------------------
    // STEP 5 — Auto zone selection
    // ---------------------------------------------------
    if (zoneData.zone === "Delhi" && delhiQty > 0) {
      return NextResponse.json({
        available: true,
        godown: "Delhi - Mundka",
        delivery_days: zoneData.baseDays,
      });
    }

    if (zoneData.zone === "South" && southQty > 0) {
      return NextResponse.json({
        available: true,
        godown: "Tamil_Nadu - Coimbatore",
        delivery_days: zoneData.baseDays,
      });
    }

    // ---------------------------------------------------
    // STEP 6 — Fallback to any available stock
    // ---------------------------------------------------
    if (delhiQty > 0) {
      return NextResponse.json({
        available: true,
        godown: "Delhi - Mundka",
        delivery_days: zoneData.baseDays + 1,
      });
    }

    if (southQty > 0) {
      return NextResponse.json({
        available: true,
        godown: "Tamil_Nadu - Coimbatore",
        delivery_days: zoneData.baseDays + 1,
      });
    }

    // ---------------------------------------------------
    // STEP 7 — No stock
    // ---------------------------------------------------
    return NextResponse.json({
      available: false,
      godown: null,
      delivery_days: null,
      note: "Stock not available",
    });
  } catch (e) {
    console.error("Estimate Delivery Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
