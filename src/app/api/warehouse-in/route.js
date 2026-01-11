import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionPayload } from "@/lib/auth";

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

  try {
    const payload = await getSessionPayload();
    console.log("Session payload:", payload);

    if (!payload) {
      console.log("Unauthorized request - no session payload");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDbConnection();
    console.log("DB connection established");

    const query = `
      SELECT 
        id,
        product_code,
        product_image,
        product_name,
        quantity,
        from_company,
        contact,
        mode_of_transport,
        porter_contact,
        created_at,
        created_by,
        status
      FROM product_stock_request
      WHERE status = 'requested'
      ORDER BY created_at DESC
    `;

    console.log("Executing GET query...");
    const [requests] = await db.execute(query);

    console.log("Fetched requests:", requests.length);

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending requests" },
      { status: 500 }
    );
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

    console.log("Reading formData...");
    const formData = await req.formData();
    const db = await getDbConnection();
    const conn = await db.getConnection();

    // Extract form fields
    const request_id = formData.get("request_id");
    const received_date = formData.get("received_date");
    const received_quantity = formData.get("received_quantity");
    const warehouse_name = formData.get("warehouse_name");
    const location = formData.get("location");
    const remarks = formData.get("remarks");

    console.log("Form Data:", {
      request_id,
      received_date,
      received_quantity,
      warehouse_name,
      location,
      remarks
    });

    // Handle file uploads
    console.log("Uploading received_image...");
    const received_image = await saveFile(formData.get("received_image"));

    console.log("Uploading supporting_doc...");
    const supporting_doc = await saveFile(formData.get("supporting_doc"));

    if (!received_image) {
      console.log("Error: Received image missing");
      return NextResponse.json(
        { error: "Received image is mandatory" },
        { status: 400 }
      );
    }

    // Start transaction
    console.log("Starting DB transaction...");
    await conn.beginTransaction();

    try {
      console.log("Fetching request by ID:", request_id);

      const [requests] = await conn.execute(
        "SELECT * FROM product_stock_request WHERE id = ?",
        [request_id]
      );

      console.log("Request found:", requests.length);

      if (requests.length === 0) {
        throw new Error("Request not found");
      }

      const request = requests[0];

      if (request.status !== 'requested') {
        console.log("Request already processed. Status:", request.status);
        return NextResponse.json({ error: "This request has already been processed." }, { status: 409 });
      }

      console.log("Updating product_stock_request with receipt details...");

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
          status = 'fulfilled'
        WHERE id = ?
      `;

      await conn.execute(updateRequestQuery, [
        username,
        received_date,
        received_quantity,
        received_image,
        supporting_doc,
        remarks,
        warehouse_name,
        location,
        request_id
      ]);

      console.log("Fetching last stock totals...");

      const [lastRows] = await conn.execute(
        `SELECT total, delhi, south FROM product_stock 
         WHERE product_code = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [request.product_code]
      );

      console.log("Last stock rows:", lastRows);

      let totalDB = 0, delhiDB = 0, southDB = 0;
      if (lastRows.length > 0) {
        totalDB = Number(lastRows[0].total) || 0;
        delhiDB = Number(lastRows[0].delhi) || 0;
        southDB = Number(lastRows[0].south) || 0;
      }

      const qtyNum = Number(received_quantity) || 0;

      const isDelhi = /delhi/i.test(String(warehouse_name || ""));
      console.log("Warehouse location check:", { isDelhi });

      const delhiD = isDelhi ? delhiDB + qtyNum : delhiDB;
      const southD = isDelhi ? southDB : southDB + qtyNum;
      const totalD = totalDB + qtyNum;

      console.log("New stock totals:", { totalD, delhiD, southD });

      console.log("Inserting into product_stock...");

      const insertStockQuery = `
        INSERT INTO product_stock (
          product_code,
          quantity,
          amount_per_unit,
          net_amount,
          note,
          location,
          stock_status,
          from_company,
          delivery_address,
          gst,
          hs_code,
          added_by,
          supporting_file,
          added_date,
          godown,
          total,
          delhi,
          south
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?)
      `;

      await conn.execute(insertStockQuery, [
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
      ]);

      console.log("Updating product_stock_summary...");

      const [summaryRows] = await conn.execute(
        "SELECT total_quantity, Delhi, South FROM product_stock_summary WHERE product_code = ?",
        [request.product_code]
      );

      console.log("Summary rows:", summaryRows);

      if (summaryRows.length > 0) {
        const existingSummary = summaryRows[0];
        const newTotal = (Number(existingSummary.total_quantity) || 0) + qtyNum;
        let newDelhi = Number(existingSummary.Delhi) || 0;
        let newSouth = Number(existingSummary.South) || 0;
        if (isDelhi) newDelhi += qtyNum; else newSouth += qtyNum;

        console.log("Updating existing summary...");

        await conn.execute(
          `UPDATE product_stock_summary
             SET last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?, last_status = 'IN', updated_at = NOW()
             WHERE product_code = ?`,
          [qtyNum, newTotal, newDelhi, newSouth, request.product_code]
        );
      } else {
        const initialDelhi = isDelhi ? qtyNum : 0;
        const initialSouth = isDelhi ? 0 : qtyNum;

        console.log("Creating new summary row...");

        await conn.execute(
          `INSERT INTO product_stock_summary
             (product_code, last_updated_quantity, total_quantity, Delhi, South, last_status)
             VALUES (?, ?, ?, ?, ?, ?)`,
          [request.product_code, qtyNum, qtyNum, initialDelhi, initialSouth, 'IN']
        );
      }

      console.log("Committing transaction...");
      await conn.commit();

      console.log("POST processing completed successfully");
      return NextResponse.json({
        success: true,
        message: "Warehouse receipt processed successfully"
      });
    } catch (error) {
      console.error("Inner transaction error:", error);
      await conn.rollback();
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
