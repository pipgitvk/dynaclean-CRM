import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionPayload } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "ADMIN", "STOCK_REQUESTS");

async function ensureUploadDir() {
  try { await fs.access(UPLOAD_DIR); } catch { await fs.mkdir(UPLOAD_DIR, { recursive: true }); }
}

// PATCH - update mode_of_transport and subfields only if status is 'requested'
export async function PATCH(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const id = formData.get('id');
      const mode_of_transport = formData.get('mode_of_transport');
      const fields = {
        self_name: formData.get('self_name'),
        courier_tracking_id: formData.get('courier_tracking_id'),
        courier_company: formData.get('courier_company'),
        porter_tracking_id: formData.get('porter_tracking_id'),
        porter_contact: formData.get('porter_contact'),
        truck_number: formData.get('truck_number'),
        driver_name: formData.get('driver_name'),
        driver_number: formData.get('driver_number'),
      };
      if (!id || !mode_of_transport) {
        return NextResponse.json({ error: 'id and mode_of_transport required' }, { status: 400 });
      }
      const quotation_upload = await saveFile(formData.get('quotation_upload'));
      const payment_proof_upload = await saveFile(formData.get('payment_proof_upload'));
      const invoice_upload = await saveFile(formData.get('invoice_upload'));
      const eway_bill = await saveFile(formData.get('eway_bill'));

      const upd = { mode_of_transport, ...fields };
      if (mode_of_transport === 'Self') {
        upd.courier_tracking_id = upd.courier_company = upd.porter_tracking_id = upd.porter_contact = upd.truck_number = upd.driver_name = upd.driver_number = null;
      } else if (mode_of_transport === 'Courier') {
        upd.self_name = upd.porter_tracking_id = upd.porter_contact = upd.truck_number = upd.driver_name = upd.driver_number = null;
      } else if (mode_of_transport === 'Porter') {
        upd.self_name = upd.courier_tracking_id = upd.courier_company = upd.truck_number = upd.driver_name = upd.driver_number = null;
      } else if (mode_of_transport === 'Truck') {
        upd.self_name = upd.courier_tracking_id = upd.courier_company = upd.porter_tracking_id = upd.porter_contact = null;
      }

      const db = await getDbConnection();
      const setParts = [
        'mode_of_transport = ?', 'self_name = ?', 'courier_tracking_id = ?', 'courier_company = ?',
        'porter_tracking_id = ?', 'porter_contact = ?', 'truck_number = ?', 'driver_name = ?', 'driver_number = ?'
      ];
      const values = [
        upd.mode_of_transport, upd.self_name, upd.courier_tracking_id, upd.courier_company,
        upd.porter_tracking_id, upd.porter_contact, upd.truck_number, upd.driver_name, upd.driver_number
      ];
      if (quotation_upload) { setParts.push('quotation_upload = ?'); values.push(quotation_upload); }
      if (payment_proof_upload) { setParts.push('payment_proof_upload = ?'); values.push(payment_proof_upload); }
      if (invoice_upload) { setParts.push('invoice_upload = ?'); values.push(invoice_upload); }
      if (eway_bill) { setParts.push('eway_bill = ?'); values.push(eway_bill); }
      values.push(id);
      const [result] = await db.execute(
        `UPDATE spare_stock_request SET ${setParts.join(', ')} WHERE id = ? AND status = 'requested'`,
        values
      );
      if (result.affectedRows === 0) {
        return NextResponse.json({ error: "Cannot edit; status is not 'requested'" }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    const body = await req.json();
    const {
      id,
      mode_of_transport,
      self_name,
      courier_tracking_id,
      courier_company,
      porter_tracking_id,
      porter_contact,
      truck_number,
      driver_name,
      driver_number,
    } = body || {};

    if (!id || !mode_of_transport) {
      return NextResponse.json({ error: "id and mode_of_transport required" }, { status: 400 });
    }

    const upd = {
      mode_of_transport,
      self_name: null,
      courier_tracking_id: null,
      courier_company: null,
      porter_tracking_id: null,
      porter_contact: null,
      truck_number: null,
      driver_name: null,
      driver_number: null,
    };
    switch (mode_of_transport) {
      case 'Self':
        upd.self_name = self_name || null;
        break;
      case 'Courier':
        upd.courier_tracking_id = courier_tracking_id || null;
        upd.courier_company = courier_company || null;
        break;
      case 'Porter':
        upd.porter_tracking_id = porter_tracking_id || null;
        upd.porter_contact = porter_contact || null;
        break;
      case 'Truck':
        upd.truck_number = truck_number || null;
        upd.driver_name = driver_name || null;
        upd.driver_number = driver_number || null;
        break;
      default:
        break;
    }

    const db = await getDbConnection();
    const [result] = await db.execute(
      `UPDATE spare_stock_request
         SET mode_of_transport = ?, self_name = ?, courier_tracking_id = ?, courier_company = ?,
             porter_tracking_id = ?, porter_contact = ?, truck_number = ?, driver_name = ?, driver_number = ?
       WHERE id = ? AND status = 'requested'`,
      [
        upd.mode_of_transport,
        upd.self_name,
        upd.courier_tracking_id,
        upd.courier_company,
        upd.porter_tracking_id,
        upd.porter_contact,
        upd.truck_number,
        upd.driver_name,
        upd.driver_number,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Cannot edit; status is not 'requested'" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Error updating spare stock request:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
async function saveFile(file) {
  if (!file) return null;
  await ensureUploadDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filepath, buffer);
  return `/ADMIN/STOCK_REQUESTS/${filename}`;
}

// GET - list spare stock requests
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = await getDbConnection();
    const [rows] = await db.execute(`
      SELECT ssr.*,
        CASE 
          WHEN ssr.status = 'requested' THEN 'Pending'
          WHEN ssr.status = 'in_warehouse' THEN 'In Warehouse'
          WHEN ssr.status = 'fulfilled' THEN 'Fulfilled'
        END as status_label
      FROM spare_stock_request ssr
      ORDER BY ssr.created_at DESC
    `);
    return NextResponse.json(rows);
  } catch (e) {
    console.error("Error fetching spare stock requests:", e);
    return NextResponse.json({ error: "Failed to fetch spare stock requests" }, { status: 500 });
  }
}

// POST - create spare stock request
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = payload.username;

    const formData = await req.formData();
    const db = await getDbConnection();

    const spare_id = formData.get("spare_id");
    const spare_name = formData.get("spare_name");
    const specification = formData.get("specification");
    const tax = formData.get("tax");
    const quantity = formData.get("quantity");
    const price_per_unit = formData.get("price_per_unit");
    const amount_per_unit = formData.get("amount_per_unit");
    const net_amount = formData.get("net_amount");
    const gst_toggle = formData.get("gst_toggle");
    const tax_amount = formData.get("tax_amount");
    const from_company = formData.get("from_company");
    const from_address = formData.get("from_address");
    const delivery_location = formData.get("delivery_location");
    const contact = formData.get("contact");
    const mode_of_transport = formData.get("mode_of_transport");
    const transportation_charges = formData.get("transportation_charges");
    const self_name = formData.get("self_name");
    const courier_tracking_id = formData.get("courier_tracking_id");
    const courier_company = formData.get("courier_company");
    const porter_tracking_id = formData.get("porter_tracking_id");
    const porter_contact = formData.get("porter_contact");
    const truck_number = formData.get("truck_number");
    const driver_name = formData.get("driver_name");
    const driver_number = formData.get("driver_number");

    const quotation_upload = await saveFile(formData.get("quotation_upload"));
    const payment_proof_upload = await saveFile(formData.get("payment_proof_upload"));
    const invoice_upload = await saveFile(formData.get("invoice_upload"));
    const spare_image = await saveFile(formData.get("spare_image"));
    const eway_bill = await saveFile(formData.get("eway_bill"));

    if (!spare_image) {
      return NextResponse.json({ error: "Spare image is mandatory" }, { status: 400 });
    }

    // Duplicate guard: normalize text fields to avoid collation issues
    const norm = (s) => (s ?? '').toString().trim().toLowerCase();
    const from_company_n = norm(from_company);
    const delivery_location_n = norm(delivery_location);
    const contact_n = norm(contact);
    const mode_of_transport_n = norm(mode_of_transport);
    const spare_id_n = Number(spare_id ?? 0);
    const quantity_n = Number(quantity ?? 0);

    const [[dup]] = await db.execute(
      `SELECT id FROM spare_stock_request
         WHERE created_by = ?
           AND spare_id = ?
           AND quantity = ?
           AND LOWER(TRIM(COALESCE(from_company, ''))) = ?
           AND LOWER(TRIM(COALESCE(delivery_location, ''))) = ?
           AND LOWER(TRIM(COALESCE(contact, ''))) = ?
           AND LOWER(TRIM(COALESCE(mode_of_transport, ''))) = ?
           AND status = 'requested'
         LIMIT 1`,
      [username, spare_id_n, quantity_n, from_company_n, delivery_location_n, contact_n, mode_of_transport_n]
    );
    if (dup && dup.id) {
      return NextResponse.json(
        { error: "Duplicate spare stock request detected for the same spare and details." },
        { status: 409 }
      );
    }

    const [result] = await db.execute(
      `INSERT INTO spare_stock_request (
        spare_id, spare_name, specification, tax, quantity, price_per_unit, amount_per_unit, net_amount, transportation_charges,
        gst_toggle, tax_amount, quotation_upload, payment_proof_upload, invoice_upload, spare_image, eway_bill,
        from_company, from_address, delivery_location, contact, mode_of_transport, self_name, courier_tracking_id,
        courier_company, porter_tracking_id, porter_contact, truck_number, driver_name, driver_number, status, created_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, 'requested', ?
      )`,
      [spare_id, spare_name, specification, tax, quantity, price_per_unit, amount_per_unit, net_amount, transportation_charges,
        gst_toggle, tax_amount, quotation_upload, payment_proof_upload, invoice_upload, spare_image, eway_bill,
        from_company, from_address, delivery_location, contact, mode_of_transport, self_name, courier_tracking_id,
        courier_company, porter_tracking_id, porter_contact, truck_number, driver_name, driver_number, username]
    );

    return NextResponse.json({ success: true, message: "Spare stock request created successfully", requestId: result.insertId });
  } catch (e) {
    console.error("Error creating spare stock request:", e);
    return NextResponse.json({ error: "Failed to create spare stock request" }, { status: 500 });
  }
}
