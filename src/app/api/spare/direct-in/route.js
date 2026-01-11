import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionPayload } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "ADMIN", "STOCK_REQUESTS");

// Ensure upload directory exists
async function ensureUploadDir() {
    try {
        await fs.access(UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
}

// Save uploaded file
async function saveFile(file) {
    if (!file) return null;

    await ensureUploadDir();

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(filepath, buffer);
    return `/ADMIN/STOCK_REQUESTS/${filename}`;
}

export async function POST(req) {
    console.log("POST /api/spare/direct-in started");

    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const username = payload.username;

        const formData = await req.formData();
        const db = await getDbConnection();
        const conn = await db.getConnection();

        // Extract form fields
        // Spare Details
        const spare_id = formData.get("spare_id");
        const spare_name = formData.get("spare_name");
        const specification = formData.get("specification");

        // Pricing & Quantity
        const tax = formData.get("tax");
        const quantity = Number(formData.get("quantity") || 0);
        const price_per_unit = formData.get("price_per_unit");
        const amount_per_unit = formData.get("amount_per_unit");
        const net_amount = formData.get("net_amount");
        const gst_toggle = formData.get("gst_toggle");
        const tax_amount = formData.get("tax_amount");
        const transportation_charges = formData.get("transportation_charges");

        // Company & Delivery
        const from_company = formData.get("from_company");
        const from_address = formData.get("from_address");
        const delivery_location = formData.get("delivery_location");
        const contact = formData.get("contact");

        // Transport
        const mode_of_transport = formData.get("mode_of_transport");
        const self_name = formData.get("self_name");
        const courier_tracking_id = formData.get("courier_tracking_id");
        const courier_company = formData.get("courier_company");
        const porter_tracking_id = formData.get("porter_tracking_id");
        const porter_contact = formData.get("porter_contact");
        const truck_number = formData.get("truck_number");
        const driver_name = formData.get("driver_name");
        const driver_number = formData.get("driver_number");

        // Warehouse Receipt Details
        const received_date = formData.get("received_date");
        const received_quantity = Number(formData.get("received_quantity") || 0);
        const warehouse_name = formData.get("warehouse_name");
        const location = formData.get("location");
        const remarks = formData.get("remarks");

        // Handle file uploads
        const quotation_upload = await saveFile(formData.get("quotation_upload"));
        const payment_proof_upload = await saveFile(formData.get("payment_proof_upload"));
        const invoice_upload = await saveFile(formData.get("invoice_upload"));
        const spare_image = await saveFile(formData.get("spare_image"));
        const eway_bill = await saveFile(formData.get("eway_bill"));
        const received_image = await saveFile(formData.get("received_image"));
        const supporting_doc = await saveFile(formData.get("supporting_doc"));

        if (!spare_image) {
            return NextResponse.json({ error: "Spare image is mandatory" }, { status: 400 });
        }
        if (!received_image) {
            return NextResponse.json({ error: "Received image is mandatory" }, { status: 400 });
        }

        // Start transaction
        await conn.beginTransaction();

        try {
            // 1. Insert into spare_stock_request with status 'fulfilled'
            const insertRequestQuery = `
        INSERT INTO spare_stock_request (
          spare_id, spare_name, specification, tax, quantity, price_per_unit, amount_per_unit, net_amount, transportation_charges,
          gst_toggle, tax_amount, quotation_upload, payment_proof_upload, invoice_upload, spare_image, eway_bill,
          from_company, from_address, delivery_location, contact, mode_of_transport, self_name, courier_tracking_id,
          courier_company, porter_tracking_id, porter_contact, truck_number, driver_name, driver_number, 
          status, created_by,
          received_by, received_date, received_quantity, received_image, supporting_doc,
          remarks, warehouse_name, location
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, 
          'fulfilled', ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `;

            const requestValues = [
                spare_id, spare_name, specification, tax, quantity, price_per_unit, amount_per_unit, net_amount, transportation_charges,
                gst_toggle, tax_amount, quotation_upload, payment_proof_upload, invoice_upload, spare_image, eway_bill,
                from_company, from_address, delivery_location, contact, mode_of_transport, self_name, courier_tracking_id,
                courier_company, porter_tracking_id, porter_contact, truck_number, driver_name, driver_number,
                username,
                username, received_date, received_quantity, received_image, supporting_doc,
                remarks, warehouse_name, location
            ];

            const [reqResult] = await conn.execute(insertRequestQuery, requestValues);
            const requestId = reqResult.insertId;

            // 2. Fetch last stock totals
            const [lastRows] = await conn.execute(
                `SELECT total, delhi, south FROM stock_list WHERE spare_id = ? ORDER BY created_at DESC LIMIT 1`,
                [spare_id]
            );

            let totalDB = 0, delhiDB = 0, southDB = 0;
            if (lastRows.length > 0) {
                totalDB = Number(lastRows[0].total) || 0;
                delhiDB = Number(lastRows[0].delhi) || 0;
                southDB = Number(lastRows[0].south) || 0;
            }

            const isDelhi = /delhi/i.test(String(warehouse_name || ""));
            const delhiD = isDelhi ? delhiDB + received_quantity : delhiDB;
            const southD = isDelhi ? southDB : southDB + received_quantity;
            const totalD = totalDB + received_quantity;

            // 3. Insert into stock_list
            const insertStockQuery = `
        INSERT INTO stock_list (
          spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, added_date, from_company, delivery_address,
          supporting_file, added_by, godown, total, Delhi, South, godown_location
        ) VALUES (?, ?, ?, ?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            await conn.execute(insertStockQuery, [
                spare_id,
                received_quantity,
                amount_per_unit,
                net_amount,
                remarks || `Direct spare stock entry #${requestId}`,
                location || delivery_location,
                received_date ? new Date(received_date) : new Date(),
                from_company,
                delivery_location,
                received_image,
                username,
                warehouse_name,
                totalD,
                delhiD,
                southD,
                null
            ]);

            // 4. Update stock_summary
            const [summaryRows] = await conn.execute(
                "SELECT total_quantity, Delhi, South FROM stock_summary WHERE spare_id = ?",
                [spare_id]
            );

            if (summaryRows.length > 0) {
                const existing = summaryRows[0];
                const newTotal = (Number(existing.total_quantity) || 0) + received_quantity;
                let newDelhi = Number(existing.Delhi) || 0;
                let newSouth = Number(existing.South) || 0;

                if (isDelhi) newDelhi += received_quantity;
                else newSouth += received_quantity;

                await conn.execute(
                    `UPDATE stock_summary SET 
            last_updated_quantity = ?, total_quantity = ?, Delhi = ?, South = ?, 
            last_status = 'IN', updated_at = NOW() 
           WHERE spare_id = ?`,
                    [received_quantity, newTotal, newDelhi, newSouth, spare_id]
                );
            } else {
                const initialDelhi = isDelhi ? received_quantity : 0;
                const initialSouth = isDelhi ? 0 : received_quantity;

                await conn.execute(
                    `INSERT INTO stock_summary 
            (spare_id, last_updated_quantity, total_quantity, Delhi, South, last_status)
           VALUES (?, ?, ?, ?, ?, 'IN')`,
                    [spare_id, received_quantity, received_quantity, initialDelhi, initialSouth]
                );
            }

            await conn.commit();

            return NextResponse.json({
                success: true,
                message: "Direct spare stock entry created successfully",
                requestId: requestId
            });

        } catch (error) {
            await conn.rollback();
            console.error("Transaction error:", error);
            throw error;
        } finally {
            conn.release();
        }

    } catch (error) {
        console.error("Error creating direct spare stock entry:", error);
        return NextResponse.json(
            { error: "Failed to create direct spare stock entry" },
            { status: 500 }
        );
    }
}
