import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import PIN_ZONES from "@/lib/pincodeZones";

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

function withStockFields(payload, stock) {
  const totalQty = Number(stock?.total || 0);
  const delhiQty = Number(stock?.delhi || 0);
  const southQty = Number(stock?.south || 0);

  return {
    ...payload,
    total_qty: totalQty,
    delhi_qty: delhiQty,
    south_qty: southQty,
  };
}

async function getItemStock(conn, item_code, type) {
  const isProduct = type === "product";

  const table = isProduct ? "product_stock_summary" : "stock_summary";
  const idColumn = isProduct ? "product_code" : "spare_id";

  let searchCode = item_code;

  if (!isProduct) {
    const [sid] = await conn.execute(
      `SELECT id FROM spare_list WHERE spare_number = ? LIMIT 1`,
      [item_code],
    );

    if (!sid.length) {
      return { found: false, stock: null, isProduct };
    }

    searchCode = sid[0].id;
  } else {
    const [productMatch] = await conn.execute(
      `SELECT item_code FROM products_list WHERE item_code = ? LIMIT 1`,
      [item_code],
    );

    if (!productMatch.length) {
      return { found: false, stock: null, isProduct };
    }
  }

  const [rows] = await conn.execute(
    `SELECT total_quantity AS total, delhi, south
     FROM ${table}
     WHERE ${idColumn} = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [searchCode],
  );

  if (!rows.length) {
    return { found: true, stock: null, isProduct };
  }

  return { found: true, stock: rows[0], isProduct };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const item_code = searchParams.get("item_code");
    const type = searchParams.get("type");

    if (!item_code) {
      return NextResponse.json({ error: "item_code is required" }, { status: 400 });
    }

    if (!type || !["product", "spare"].includes(type)) {
      return NextResponse.json({ error: "type must be product or spare" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const { found, stock } = await getItemStock(conn, item_code, type);

    if (!found) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(
      withStockFields({ success: true }, stock || { total: 0, delhi: 0, south: 0 }),
    );
  } catch (e) {
    console.error("Estimate Delivery Stock Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { item_code, pincode, godown, type } = body || {};

    if (!item_code) {
      return NextResponse.json({ error: "item_code is required" }, { status: 400 });
    }

    if (!pincode) {
      return NextResponse.json({ error: "pincode is required" }, { status: 400 });
    }

    const pin = normalizePin(pincode);
    const zoneData = getZoneForPin(pin);
    const conn = await getDbConnection();

    let resolvedType = type;
    if (!resolvedType) {
      const [productMatch] = await conn.execute(
        `SELECT item_code FROM products_list WHERE item_code = ? LIMIT 1`,
        [item_code],
      );
      const [spareMatch] = await conn.execute(
        `SELECT spare_number FROM spare_list WHERE spare_number = ? LIMIT 1`,
        [item_code],
      );

      if (productMatch.length) resolvedType = "product";
      else if (spareMatch.length) resolvedType = "spare";
      else {
        return NextResponse.json(
          withStockFields(
            {
              available: false,
              godown: null,
              delivery_days: null,
              note: "Item not found in products or spares",
            },
            null,
          ),
        );
      }
    }

    const { found, stock } = await getItemStock(conn, item_code, resolvedType);

    if (!found) {
      return NextResponse.json(
        withStockFields(
          {
            available: false,
            godown: null,
            delivery_days: null,
            note: "Item not found in products or spares",
          },
          null,
        ),
      );
    }

    if (!stock) {
      return NextResponse.json(
        withStockFields(
          {
            available: false,
            godown: null,
            delivery_days: null,
            note: "No stock record found",
          },
          null,
        ),
      );
    }

    const delhiQty = Number(stock.delhi || 0);
    const southQty = Number(stock.south || 0);
    const emptyStock = { total: stock.total, delhi: delhiQty, south: southQty };

    if (godown) {
      if (godown === "Delhi - Mundka" && delhiQty > 0) {
        return NextResponse.json(
          withStockFields(
            { available: true, godown, delivery_days: zoneData.baseDays },
            emptyStock,
          ),
        );
      }

      if (godown === "Tamil_Nadu - Coimbatore" && southQty > 0) {
        return NextResponse.json(
          withStockFields(
            { available: true, godown, delivery_days: zoneData.baseDays },
            emptyStock,
          ),
        );
      }
    }

    if (zoneData.zone === "Delhi" && delhiQty > 0) {
      return NextResponse.json(
        withStockFields(
          {
            available: true,
            godown: "Delhi - Mundka",
            delivery_days: zoneData.baseDays,
          },
          emptyStock,
        ),
      );
    }

    if (zoneData.zone === "South" && southQty > 0) {
      return NextResponse.json(
        withStockFields(
          {
            available: true,
            godown: "Tamil_Nadu - Coimbatore",
            delivery_days: zoneData.baseDays,
          },
          emptyStock,
        ),
      );
    }

    if (delhiQty > 0) {
      return NextResponse.json(
        withStockFields(
          {
            available: true,
            godown: "Delhi - Mundka",
            delivery_days: zoneData.baseDays + 1,
          },
          emptyStock,
        ),
      );
    }

    if (southQty > 0) {
      return NextResponse.json(
        withStockFields(
          {
            available: true,
            godown: "Tamil_Nadu - Coimbatore",
            delivery_days: zoneData.baseDays + 1,
          },
          emptyStock,
        ),
      );
    }

    return NextResponse.json(
      withStockFields(
        {
          available: false,
          godown: null,
          delivery_days: null,
          note: "Stock not available",
        },
        emptyStock,
      ),
    );
  } catch (e) {
    console.error("Estimate Delivery Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
