import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionPayload } from "@/lib/auth";
import { usesWarehouseInInchargeFlow } from "@/lib/warehouseInAccess.server";

const UPLOAD_DIR = path.join(process.cwd(), "public", "ADMIN", "STOCK_REQUESTS");

async function ensureUploadDir() {
  console.log("[LOG] Checking upload directory:", UPLOAD_DIR);
  try {
    await fs.access(UPLOAD_DIR);
    console.log("[LOG] Upload directory exists");
  } catch {
    console.log("[LOG] Upload directory missing — creating...");
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

async function saveFile(file) {
  console.log("[LOG] saveFile() called with:", file?.name || "NO FILE");
  if (!file) return null;

  await ensureUploadDir();

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  console.log("[LOG] Saving file at path:", filepath);

  await fs.writeFile(filepath, buffer);
  return `/ADMIN/STOCK_REQUESTS/${filename}`;
}

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

// ---------------- GET — Pending Spare Stock Requests ----------------
export async function GET() {
  console.log("[GET] Fetching pending spare stock requests…");

  try {
    const payload = await getSessionPayload();
    console.log("[GET] Session payload:", payload);

    if (!payload) {
      console.log("[GET] Unauthorized user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inchargeFlow = await usesWarehouseInInchargeFlow(payload);

    const pool = await getDbConnection();
    const [requests] = await pool.execute(`
      SELECT id, spare_id, spare_name, spare_image, quantity,
             ${inchargeFlow ? "COALESCE(received_quantity, 0) AS received_quantity," : ""}
             from_company, contact,
             mode_of_transport, porter_contact, created_at, created_by, status
      FROM spare_stock_request
      WHERE status = 'requested'
        ${
          inchargeFlow
            ? "AND quantity > COALESCE(received_quantity, 0)"
            : "AND COALESCE(received_quantity, 0) = 0"
        }
      ORDER BY created_at DESC
    `);

    console.log(`[GET] Found ${requests.length} pending requests`);

    return NextResponse.json(requests);
  } catch (e) {
    console.error("[GET] Error fetching pending spare requests:", e);
    return NextResponse.json({ error: "Failed to fetch pending requests" }, { status: 500 });
  }
}

// ---------------- POST — Process Warehouse Spare Receipt ----------------
export async function POST(req) {
  console.log("[POST] Processing spare warehouse receipt…");

  try {
    const payload = await getSessionPayload();
    console.log("[POST] Session payload:", payload);

    if (!payload) {
      console.log("[POST] Unauthorized access");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = payload.username;
    const inchargeFlow = await usesWarehouseInInchargeFlow(payload);

    console.log("[POST] Reading form data...");
    const formData = await req.formData();

    const db = await getDbConnection();
    const conn = await db.getConnection();
    console.log("[POST] DB connection + transaction initialized");

    // Extract fields
    const request_id = formData.get("request_id");
    const received_date = formData.get("received_date");
    const qtyThisReceipt = Number(formData.get("received_quantity") || 0);
    const warehouse_name = formData.get("warehouse_name");
    const location = formData.get("location");
    const remarks = formData.get("remarks");

    console.log("[POST] Form data:", {
      request_id, received_date, received_quantity: qtyThisReceipt, warehouse_name, location, remarks
    });

    // Upload files
    console.log("[POST] Uploading received_image...");
    const received_image = await saveFile(formData.get("received_image"));

    console.log("[POST] Uploading supporting document(s)...");
    const supporting_doc = await saveSupportingDocs(formData);

    if (!received_image) {
      console.log("[POST] ERROR: Received image is missing");
      return NextResponse.json({ error: "Received image is mandatory" }, { status: 400 });
    }

    await conn.beginTransaction();
    console.log("[POST] Transaction started");

    try {
      console.log("[POST] Fetching spare_stock_request by ID:", request_id);

      const [rows] = await conn.execute(
        "SELECT * FROM spare_stock_request WHERE id = ?",
        [request_id]
      );

      console.log("[POST] Request found:", rows.length);

      if (rows.length === 0) throw new Error("Request not found");

      const reqRow = rows[0];

      if (reqRow.status !== "requested") {
        console.log("[POST] Request already processed — status:", reqRow.status);
        return NextResponse.json({ error: "This request has already been processed." }, { status: 409 });
      }

      const requestedQty = Number(reqRow.quantity) || 0;
      const prevReceived = Number(reqRow.received_quantity) || 0;

      if (qtyThisReceipt < 1) {
        await conn.rollback();
        return NextResponse.json({ error: "Invalid received quantity" }, { status: 400 });
      }

      let newReceivedTotal = qtyThisReceipt;
      let isComplete = true;

      if (inchargeFlow) {
        const remainingBefore = requestedQty - prevReceived;
        if (qtyThisReceipt > remainingBefore) {
          await conn.rollback();
          return NextResponse.json(
            {
              error: `Cannot receive ${qtyThisReceipt}; only ${remainingBefore} remaining on this request.`,
            },
            { status: 400 },
          );
        }
        newReceivedTotal = prevReceived + qtyThisReceipt;
        isComplete = newReceivedTotal >= requestedQty;
      } else {
        if (prevReceived > 0) {
          await conn.rollback();
          return NextResponse.json(
            {
              error:
                "This request is partially received. Warehouse Incharge must complete it.",
            },
            { status: 409 },
          );
        }
        newReceivedTotal = qtyThisReceipt;
        isComplete = true;
      }

      console.log("[POST] Updating spare_stock_request…", {
        newReceivedTotal,
        isComplete,
      });

      await conn.execute(
        `UPDATE spare_stock_request SET 
          received_by = ?, received_date = ?, received_quantity = ?, received_image = ?, supporting_doc = ?, 
          remarks = ?, warehouse_name = ?, location = ?, status = ?
         WHERE id = ?`,
        [
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
        ],
      );

      // Fetch last stock totals
      console.log("[POST] Fetching previous stock_list totals…");

      const [lastRows] = await conn.execute(
        `SELECT total, delhi, south FROM stock_list WHERE spare_id = ? ORDER BY created_at DESC LIMIT 1`,
        [reqRow.spare_id]
      );

      console.log("[POST] Previous totals:", lastRows);

      let totalDB = 0, delhiDB = 0, southDB = 0;
      if (lastRows.length > 0) {
        totalDB = Number(lastRows[0].total) || 0;
        delhiDB = Number(lastRows[0].delhi) || 0;
        southDB = Number(lastRows[0].south) || 0;
      }

      const isDelhi = /delhi/i.test(String(warehouse_name || ""));
      console.log("[POST] Warehouse location parsed:", { isDelhi });

      const delhiD = isDelhi ? delhiDB + qtyThisReceipt : delhiDB;
      const southD = isDelhi ? southDB : southDB + qtyThisReceipt;
      const totalD = totalDB + qtyThisReceipt;
      const unitPrice = Number(reqRow.amount_per_unit) || 0;
      const lineNetAmount = inchargeFlow
        ? unitPrice * qtyThisReceipt
        : Number(reqRow.net_amount) || unitPrice * qtyThisReceipt;

      console.log("[POST] New computed totals:", { delhiD, southD, totalD });

      // Insert IN movement
      console.log("[POST] Inserting stock_list (IN)…");

      await conn.execute(
        `INSERT INTO stock_list (
          spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, added_date, from_company,delivery_address,
          supporting_file, added_by, godown, total, Delhi, South, godown_location
        ) VALUES (?, ?, ?, ?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reqRow.spare_id,
          qtyThisReceipt,
          unitPrice,
          lineNetAmount,
          remarks ||
            `Spare request #${request_id} — received ${qtyThisReceipt}${isComplete ? "" : " (partial)"}`,
          location,
          received_date ? new Date(received_date) : new Date(),
          reqRow.from_company,
          reqRow.delivery_location,
          received_image,
          username,
          warehouse_name,
          totalD,
          delhiD,
          southD,
          null
        ]
      );

      // Update summary table
      console.log("[POST] Updating stock_summary…");

      const [summaryRows] = await conn.execute(
        "SELECT total_quantity, Delhi, South FROM stock_summary WHERE spare_id = ?",
        [reqRow.spare_id]
      );

      console.log("[POST] Summary rows:", summaryRows);

      if (summaryRows.length > 0) {
        const existing = summaryRows[0];
        const newTotal = (Number(existing.total_quantity) || 0) + qtyThisReceipt;
        let newDelhi = Number(existing.Delhi) || 0;
        let newSouth = Number(existing.South) || 0;

        if (isDelhi) newDelhi += qtyThisReceipt;
        else newSouth += qtyThisReceipt;

        await conn.execute(
          `UPDATE stock_summary SET 
            last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?, 
            last_status = 'IN', updated_at = NOW() 
           WHERE spare_id = ?`,
          [qtyThisReceipt, newTotal, newDelhi, newSouth, reqRow.spare_id]
        );
        console.log("[POST] Updated existing summary");
      } else {
        const initialDelhi = isDelhi ? qtyThisReceipt : 0;
        const initialSouth = isDelhi ? 0 : qtyThisReceipt;

        await conn.execute(
          `INSERT INTO stock_summary 
            (spare_id, last_updated_quantity, total_quantity, Delhi, South, last_status)
           VALUES (?, ?, ?, ?, ?, 'IN')`,
          [reqRow.spare_id, qtyThisReceipt, qtyThisReceipt, initialDelhi, initialSouth]
        );

        console.log("[POST] Created new summary row");
      }

      await conn.commit();
      console.log("[POST] Transaction committed successfully");

      return NextResponse.json({
        success: true,
        message: isComplete
          ? "Spare stock updated — request fully received"
          : `Spare stock +${qtyThisReceipt} (partial — ${newReceivedTotal}/${requestedQty} received)`,
        stock_added: qtyThisReceipt,
        received_total: newReceivedTotal,
        requested_quantity: requestedQty,
        is_complete: isComplete,
      });
    } catch (e) {
      console.error("[POST] Error in transaction:", e);
      await conn.rollback();
      throw e;
    } finally {
      console.log("[POST] Releasing DB connection");
      conn.release();
    }
  } catch (e) {
    console.error("[POST] Fatal error:", e);
    return NextResponse.json({ error: "Failed to process warehouse receipt" }, { status: 500 });
  }
}
