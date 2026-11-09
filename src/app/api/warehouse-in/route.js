import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionPayload } from "@/lib/auth";
import { usesWarehouseInInchargeFlow } from "@/lib/warehouseInAccess.server";

const UPLOAD_DIR = path.join(process.cwd(), "public", "ADMIN", "STOCK_REQUESTS");

// Ensure upload directory exists
async function ensureUploadDir() {
  console.log("Checking upload directory:", UPLOAD_DIR);
  try {
    await fs.access(UPLOAD_DIR);
    console.log("Upload directory exists");
  } catch {
    console.log("Upload directory missing. Creating...");
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Save uploaded file
async function saveSupportingDocs(formData) {
  const paths = [];
  const multi = formData.getAll("supporting_docs");
  const legacy = formData.get("supporting_doc");
  const files = multi.length > 0 ? multi : legacy ? [legacy] : [];
  for (const file of files) {
    if (!file || typeof file === "string") continue;
    const p = await saveFile(file);
    if (p) paths.push(p);
  }
  if (paths.length === 0) return null;
  if (paths.length === 1) return paths[0];
  return JSON.stringify(paths);
}

async function saveFile(file) {
  console.log("saveFile() called with:", file ? file.name : null);

  if (!file) {
    console.log("No file received.");
    return null;
  }

  await ensureUploadDir();

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  console.log("Saving file:", filepath);

  await fs.writeFile(filepath, buffer);
  return `/ADMIN/STOCK_REQUESTS/${filename}`;
}

// GET - Fetch pending stock requests for warehouse in
export async function GET(req) {
  console.log("GET /warehouse-request started");

  let conn;
  try {
    const payload = await getSessionPayload();
    console.log("Session payload:", payload);

    if (!payload) {
      console.log("Unauthorized request - no session payload");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inchargeFlow = await usesWarehouseInInchargeFlow(payload);

    const pool = await getDbConnection();
    conn = await pool.getConnection();
    console.log("DB connection established");

    const query = `
      SELECT 
        psr.id,
        psr.product_code,
        psr.product_image,
        psr.product_name,
        psr.quantity,
        ${inchargeFlow ? "COALESCE(psr.received_quantity, 0) AS received_quantity," : ""}
        psr.from_company,
        psr.contact,
        psr.mode_of_transport,
        psr.porter_contact,
        psr.created_at,
        psr.created_by,
        psr.status,
        psr.invoice_number,
        psr.invoice_date,
        CASE 
          WHEN TRIM(COALESCE(psr.product_code, '')) = '' THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM products_list pl
            WHERE LOWER(TRIM(pl.item_code)) = LOWER(TRIM(psr.product_code))
          ) THEN 'Product'
          WHEN EXISTS (
            SELECT 1 FROM spare_list sl
            WHERE CAST(sl.spare_number AS CHAR) = TRIM(CAST(psr.product_code AS CHAR))
               OR CAST(sl.id AS CHAR) = TRIM(CAST(psr.product_code AS CHAR))
          ) THEN 'Spare'
          ELSE NULL
        END AS item_category
      FROM product_stock_request psr
      WHERE psr.status = 'requested'
        ${
          inchargeFlow
            ? "AND psr.quantity > COALESCE(psr.received_quantity, 0)"
            : "AND COALESCE(psr.received_quantity, 0) = 0"
        }
      ORDER BY psr.created_at DESC
    `;

    console.log("Executing GET query...");
    const [requests] = await conn.execute(query);

    const normalized = requests.map((row) => {
      const category =
        row.item_category === "Product" || row.item_category === "Spare"
          ? row.item_category
          : null;
      const { item_category, ...rest } = row;
      return { ...rest, category };
    });

    console.log("Fetched requests:", normalized.length);

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending requests" },
      { status: 500 }
    );
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
}

// POST - Process warehouse receipt and update stock
export async function POST(req) {
  console.log("POST /warehouse-request started");

  try {
    const payload = await getSessionPayload();
    console.log("Session payload:", payload);

    if (!payload) {
      console.log("Unauthorized POST - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = payload.username;
    const inchargeFlow = await usesWarehouseInInchargeFlow(payload);

    console.log("Reading formData...");
    const formData = await req.formData();
    const db = await getDbConnection();
    const conn = await db.getConnection();

    const received_date = formData.get("received_date");
    const warehouse_name = formData.get("warehouse_name");
    const location = formData.get("location");
    const remarks = formData.get("remarks");

    let lineItems = [];
    const bulkRaw = formData.get("bulk_items");
    if (bulkRaw) {
      try {
        const parsed = JSON.parse(String(bulkRaw));
        if (Array.isArray(parsed) && parsed.length > 0) {
          lineItems = parsed.map((row) => ({
            request_id: Number(row.request_id),
            received_quantity: Number(row.received_quantity),
          }));
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid bulk_items payload" },
          { status: 400 },
        );
      }
    }
    if (lineItems.length === 0) {
      const request_id = formData.get("request_id");
      lineItems = [
        {
          request_id: Number(request_id),
          received_quantity: Number(formData.get("received_quantity")),
        },
      ];
    }

    if (lineItems.some((i) => !i.request_id || !i.received_quantity)) {
      return NextResponse.json(
        { error: "Each line needs request_id and received_quantity" },
        { status: 400 },
      );
    }

    const received_image = await saveFile(formData.get("received_image"));
    const supporting_doc = await saveSupportingDocs(formData);

    if (!received_image) {
      return NextResponse.json(
        { error: "Received image is mandatory" },
        { status: 400 },
      );
    }

    await conn.beginTransaction();

    try {
      for (const line of lineItems) {
        const request_id = line.request_id;
        const received_quantity = line.received_quantity;

      const [requests] = await conn.execute(
        "SELECT * FROM product_stock_request WHERE id = ?",
        [request_id]
      );

      if (requests.length === 0) {
        throw new Error(`Request not found: ${request_id}`);
      }

      const request = requests[0];

      if (request.status !== "requested") {
        const err = new Error(`Request #${request_id} was already processed.`);
        err.statusCode = 409;
        throw err;
      }

      const requestedQty = Number(request.quantity) || 0;
      const prevReceived = Number(request.received_quantity) || 0;
      const qtyNum = Number(received_quantity) || 0;

      if (qtyNum < 1) {
        const err = new Error(`Invalid received quantity for request #${request_id}`);
        err.statusCode = 400;
        throw err;
      }

      let newReceivedTotal = qtyNum;
      let isComplete = true;
      const unitPrice = Number(request.amount_per_unit) || 0;
      let lineNetAmount = unitPrice * qtyNum;

      if (inchargeFlow) {
        const remainingBefore = requestedQty - prevReceived;
        if (qtyNum > remainingBefore) {
          const err = new Error(
            `Request #${request_id}: cannot receive ${qtyNum}; only ${remainingBefore} remaining.`,
          );
          err.statusCode = 400;
          throw err;
        }
        newReceivedTotal = prevReceived + qtyNum;
        isComplete = newReceivedTotal >= requestedQty;
        lineNetAmount = unitPrice * qtyNum;
      } else {
        if (prevReceived > 0) {
          const err = new Error(
            `Request #${request_id} is partially received. Warehouse Incharge must complete it.`,
          );
          err.statusCode = 409;
          throw err;
        }
        newReceivedTotal = qtyNum;
        isComplete = true;
        lineNetAmount = Number(request.net_amount) || unitPrice * qtyNum;
      }

      const updateRequestQuery = `
        UPDATE product_stock_request
        SET 
          received_by = ?,
          received_date = ?,
          received_quantity = ?,
          received_image = ?,
          supporting_doc = ?,
          remarks = ?,
          warehouse_name = ?,
          location = ?,
          status = ?
        WHERE id = ?
      `;

      await conn.execute(updateRequestQuery, [
        username,
        received_date,
        newReceivedTotal,
        received_image,
        supporting_doc,
        remarks,
        warehouse_name,
        location,
        isComplete ? "fulfilled" : "requested",
        request_id,
      ]);
      const isDelhi = /delhi/i.test(String(warehouse_name || ""));

      // Determine if this product_code belongs to a spare or a product
      // product_stock_request stores spare items using spare_number (INT column) as product_code
      // Match by spare_number (cast to char) OR by id (cast to char) for backward compat
      const [[spareMatch]] = await conn.execute(
        `SELECT id FROM spare_list WHERE CAST(spare_number AS CHAR) = ? OR CAST(id AS CHAR) = ? LIMIT 1`,
        [String(request.product_code), String(request.product_code)]
      );
      const [[productMatch]] = await conn.execute(
        `SELECT 1 AS found FROM products_list WHERE LOWER(TRIM(item_code)) = LOWER(TRIM(?)) LIMIT 1`,
        [request.product_code]
      );

      // A record is a spare if spare_list match found AND no product match
      const isSpare = !!spareMatch?.id && !productMatch?.found;
      const spare_id = isSpare ? spareMatch.id : null;

      console.log(`Routing: product_code=${request.product_code}, isSpare=${isSpare}, spare_id=${spare_id}`);

      if (isSpare) {
        // ---- SPARE: insert into stock_list + stock_summary ----
        console.log("Spare detected → inserting into stock_list / stock_summary");

        const [lastSpareRows] = await conn.execute(
          `SELECT total, delhi, south FROM stock_list WHERE spare_id = ? ORDER BY created_at DESC LIMIT 1`,
          [spare_id]
        );

        let totalDB = 0, delhiDB = 0, southDB = 0;
        if (lastSpareRows.length > 0) {
          totalDB = Number(lastSpareRows[0].total) || 0;
          delhiDB = Number(lastSpareRows[0].delhi) || 0;
          southDB = Number(lastSpareRows[0].south) || 0;
        }

        const delhiD = isDelhi ? delhiDB + qtyNum : delhiDB;
        const southD = isDelhi ? southDB : southDB + qtyNum;
        const totalD = totalDB + qtyNum;

        await conn.execute(
          `INSERT INTO stock_list (
            spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status,
            added_date, from_company, delivery_address, supporting_file, added_by,
            godown, total, Delhi, South, godown_location
          ) VALUES (?, ?, ?, ?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            spare_id,
            qtyNum,
            unitPrice,
            lineNetAmount,
            remarks ||
              `Stock request #${request_id} — spare +${qtyNum}${isComplete ? "" : " (partial)"}`,
            location || request.delivery_location,
            received_date ? new Date(received_date) : new Date(),
            request.from_company,
            request.delivery_location,
            received_image,
            username,
            warehouse_name,
            totalD,
            delhiD,
            southD,
            null
          ]
        );

        const [spareSummaryRows] = await conn.execute(
          "SELECT total_quantity, Delhi, South FROM stock_summary WHERE spare_id = ?",
          [spare_id]
        );

        if (spareSummaryRows.length > 0) {
          const existing = spareSummaryRows[0];
          const newTotal = (Number(existing.total_quantity) || 0) + qtyNum;
          let newDelhi = Number(existing.Delhi) || 0;
          let newSouth = Number(existing.South) || 0;
          if (isDelhi) newDelhi += qtyNum; else newSouth += qtyNum;

          await conn.execute(
            `UPDATE stock_summary SET
              last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?,
              last_status = 'IN', updated_at = NOW()
             WHERE spare_id = ?`,
            [qtyNum, newTotal, newDelhi, newSouth, spare_id]
          );
        } else {
          const initialDelhi = isDelhi ? qtyNum : 0;
          const initialSouth = isDelhi ? 0 : qtyNum;

          await conn.execute(
            `INSERT INTO stock_summary
              (spare_id, last_updated_quantity, total_quantity, Delhi, South, last_status)
             VALUES (?, ?, ?, ?, ?, 'IN')`,
            [spare_id, qtyNum, qtyNum, initialDelhi, initialSouth]
          );
        }

        console.log("Spare stock updated in stock_list / stock_summary");

      } else {
        // ---- PRODUCT: insert into product_stock + product_stock_summary ----
        console.log("Product detected → inserting into product_stock / product_stock_summary");

        const [lastRows] = await conn.execute(
          `SELECT total, delhi, south FROM product_stock 
           WHERE product_code = ? 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [request.product_code]
        );

        let totalDB = 0, delhiDB = 0, southDB = 0;
        if (lastRows.length > 0) {
          totalDB = Number(lastRows[0].total) || 0;
          delhiDB = Number(lastRows[0].delhi) || 0;
          southDB = Number(lastRows[0].south) || 0;
        }

        const delhiD = isDelhi ? delhiDB + qtyNum : delhiDB;
        const southD = isDelhi ? southDB : southDB + qtyNum;
        const totalD = totalDB + qtyNum;

        await conn.execute(
          `INSERT INTO product_stock (
            product_code, quantity, amount_per_unit, net_amount, note, location,
            stock_status, from_company, delivery_address, gst, hs_code, added_by,
            supporting_file, added_date, godown, total, delhi, south
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            request.product_code,
            qtyNum,
            request.amount_per_unit,
            request.net_amount,
            remarks || `Stock request #${request_id} fulfilled`,
            location || request.delivery_location,
            'IN',
            request.from_company,
            request.delivery_location,
            String(request.gst_rate ?? ''),
            request.hsn,
            username,
            received_image,
            received_date ? new Date(received_date) : new Date(),
            warehouse_name,
            totalD,
            delhiD,
            southD
          ]
        );

        const [summaryRows] = await conn.execute(
          "SELECT total_quantity, Delhi, South FROM product_stock_summary WHERE product_code = ?",
          [request.product_code]
        );

        if (summaryRows.length > 0) {
          const existingSummary = summaryRows[0];
          const newTotal = (Number(existingSummary.total_quantity) || 0) + qtyNum;
          let newDelhi = Number(existingSummary.Delhi) || 0;
          let newSouth = Number(existingSummary.South) || 0;
          if (isDelhi) newDelhi += qtyNum; else newSouth += qtyNum;

          await conn.execute(
            `UPDATE product_stock_summary
               SET last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?,
                   last_status = 'IN', updated_at = NOW()
               WHERE product_code = ?`,
            [qtyNum, newTotal, newDelhi, newSouth, request.product_code]
          );
        } else {
          const initialDelhi = isDelhi ? qtyNum : 0;
          const initialSouth = isDelhi ? 0 : qtyNum;

          await conn.execute(
            `INSERT INTO product_stock_summary
               (product_code, last_updated_quantity, total_quantity, Delhi, South, last_status)
               VALUES (?, ?, ?, ?, ?, ?)`,
            [request.product_code, qtyNum, qtyNum, initialDelhi, initialSouth, 'IN']
          );
        }

        console.log("Product stock updated in product_stock / product_stock_summary");
      }
      }

      await conn.commit();

      return NextResponse.json({
        success: true,
        message:
          lineItems.length > 1
            ? `Warehouse receipt processed for ${lineItems.length} items`
            : "Warehouse receipt processed successfully",
        processed_count: lineItems.length,
      });
    } catch (error) {
      console.error("Inner transaction error:", error);
      await conn.rollback();
      if (error.statusCode === 409 || error.statusCode === 400) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode },
        );
      }
      throw error;
    } finally {
      console.log("Releasing DB connection...");
      conn.release();
    }
  } catch (error) {
    console.error("Error processing warehouse receipt:", error);
    return NextResponse.json(
      { error: "Failed to process warehouse receipt" },
      { status: 500 }
    );
  }
}
