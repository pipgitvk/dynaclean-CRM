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

// PATCH - update mode_of_transport and its subfields only if status is 'requested'
export async function PATCH(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const id = formData.get('id');
      const mode_of_transport = formData.get('mode_of_transport');
      const net_amount = formData.get('net_amount');
      const price_per_unit = formData.get('price_per_unit');
      let created_at = formData.get('created_at');
      const invoice_number = formData.get('invoice_number');
      let invoice_date = formData.get('invoice_date');
      
      // Customer fields
      const customer_id = formData.get('customer_id');
      const client_name = formData.get('client_name');
      const client_company_name = formData.get('client_company_name');
      const client_number = formData.get('client_number');
      const client_email = formData.get('client_email');
      const client_gstin = formData.get('client_gstin');
      const customer_address = formData.get('customer_address');
      
      // Convert date format (YYYY-MM-DD) to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
      if (created_at && created_at.includes('-') && !created_at.includes(' ')) {
        created_at = created_at + ' 00:00:00';
      } else if (created_at && created_at.includes('T')) {
        // Convert datetime-local format (YYYY-MM-DDTHH:MM) to MySQL format (YYYY-MM-DD HH:MM:SS)
        created_at = created_at.replace('T', ' ') + ':00';
      }
      if (invoice_date && invoice_date.includes('T')) {
        invoice_date = invoice_date.split('T')[0];
      }
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
      
      // If we're just updating customer fields, we don't need mode_of_transport
      const isCustomerUpdate = customer_id || client_name || client_company_name || client_number || client_email || client_gstin || customer_address;
      
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }
      
      // Save any provided files
      const quotation_upload = await saveFile(formData.get('quotation_upload'));
      const payment_proof_upload = await saveFile(formData.get('payment_proof_upload'));
      const invoice_upload = await saveFile(formData.get('invoice_upload'));
      const eway_bill = await saveFile(formData.get('eway_bill'));

      // Normalize subfields if we have mode_of_transport
      let upd = {};
      if (mode_of_transport) {
        upd = { mode_of_transport, ...fields };
        if (mode_of_transport === 'Self') {
          upd.courier_tracking_id = upd.courier_company = upd.porter_tracking_id = upd.porter_contact = upd.truck_number = upd.driver_name = upd.driver_number = null;
        } else if (mode_of_transport === 'Courier') {
          upd.self_name = upd.porter_tracking_id = upd.porter_contact = upd.truck_number = upd.driver_name = upd.driver_number = null;
        } else if (mode_of_transport === 'Porter') {
          upd.self_name = upd.courier_tracking_id = upd.courier_company = upd.truck_number = upd.driver_name = upd.driver_number = null;
        } else if (mode_of_transport === 'Truck') {
          upd.self_name = upd.courier_tracking_id = upd.courier_company = upd.porter_tracking_id = upd.porter_contact = null;
        }
      }

      const db = await getDbConnection();
      // Build dynamic SET
      const setParts = [];
      const values = [];
      
      if (mode_of_transport) {
        setParts.push('mode_of_transport = ?');
        values.push(upd.mode_of_transport);
        setParts.push('self_name = ?');
        values.push(upd.self_name);
        setParts.push('courier_tracking_id = ?');
        values.push(upd.courier_tracking_id);
        setParts.push('courier_company = ?');
        values.push(upd.courier_company);
        setParts.push('porter_tracking_id = ?');
        values.push(upd.porter_tracking_id);
        setParts.push('porter_contact = ?');
        values.push(upd.porter_contact);
        setParts.push('truck_number = ?');
        values.push(upd.truck_number);
        setParts.push('driver_name = ?');
        values.push(upd.driver_name);
        setParts.push('driver_number = ?');
        values.push(upd.driver_number);
      }
      
      // Add customer fields
      if (customer_id !== undefined) { setParts.push('customer_id = ?'); values.push(customer_id); }
      if (client_name !== undefined) { setParts.push('client_name = ?'); values.push(client_name); }
      if (client_company_name !== undefined) { setParts.push('client_company_name = ?'); values.push(client_company_name); }
      if (client_number !== undefined) { setParts.push('client_number = ?'); values.push(client_number); }
      if (client_email !== undefined) { setParts.push('client_email = ?'); values.push(client_email); }
      if (client_gstin !== undefined) { setParts.push('client_gstin = ?'); values.push(client_gstin); }
      if (customer_address !== undefined) { setParts.push('customer_address = ?'); values.push(customer_address); }
      
      if (net_amount !== null && net_amount !== '') { setParts.push('net_amount = ?'); values.push(net_amount); }
      if (price_per_unit !== null && price_per_unit !== '') { setParts.push('price_per_unit = ?'); values.push(price_per_unit); }
      if (created_at !== null && created_at !== '') { setParts.push('created_at = ?'); values.push(created_at); }
      if (invoice_number !== null && invoice_number !== '') { setParts.push('invoice_number = ?'); values.push(invoice_number); }
      if (invoice_date !== null && invoice_date !== '') { setParts.push('invoice_date = ?'); values.push(invoice_date); }
      if (quotation_upload) { setParts.push('quotation_upload = ?'); values.push(quotation_upload); }
      if (payment_proof_upload) { setParts.push('payment_proof_upload = ?'); values.push(payment_proof_upload); }
      if (invoice_upload) { setParts.push('invoice_upload = ?'); values.push(invoice_upload); }
      if (eway_bill) { setParts.push('eway_bill = ?'); values.push(eway_bill); }
      
      values.push(id);
      
      if (setParts.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }
      
      const [result] = await db.execute(
        `UPDATE product_stock_request SET ${setParts.join(', ')} WHERE id = ?`,
        values
      );
      if (result.affectedRows === 0) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    const body = await req.json();
    const {
      id,
      mode_of_transport,
      net_amount,
      price_per_unit,
      created_at,
      invoice_number,
      invoice_date,
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

    // Normalize fields: clear irrelevant subfields based on selected mode
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
    let query = `UPDATE product_stock_request
         SET mode_of_transport = ?, self_name = ?, courier_tracking_id = ?, courier_company = ?,
             porter_tracking_id = ?, porter_contact = ?, truck_number = ?, driver_name = ?, driver_number = ?`;
    const values = [
        upd.mode_of_transport,
        upd.self_name,
        upd.courier_tracking_id,
        upd.courier_company,
        upd.porter_tracking_id,
        upd.porter_contact,
        upd.truck_number,
        upd.driver_name,
        upd.driver_number,
    ];
    if (net_amount !== null && net_amount !== undefined) {
      query += `, net_amount = ?`;
      values.push(net_amount);
    }
    if (price_per_unit !== null && price_per_unit !== undefined) {
      query += `, price_per_unit = ?`;
      values.push(price_per_unit);
    }
    if (created_at !== null && created_at !== undefined) {
      query += `, created_at = ?`;
      values.push(created_at);
    }
    if (invoice_number !== null && invoice_number !== undefined) {
      query += `, invoice_number = ?`;
      values.push(invoice_number);
    }
    if (invoice_date !== null && invoice_date !== undefined) {
      query += `, invoice_date = ?`;
      values.push(invoice_date);
    }
    query += ` WHERE id = ?`;
    values.push(id);
    const [result] = await db.execute(query, values);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Error updating stock request:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
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

// GET - Fetch all stock requests
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = await getDbConnection();

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    let query = `
      SELECT 
        psr.*,
        CASE 
          WHEN psr.status = 'requested' THEN 'Pending'
          WHEN psr.status = 'in_warehouse' THEN 'In Warehouse'
          WHEN psr.status = 'fulfilled' THEN 'Fulfilled'
        END as status_label
      FROM product_stock_request psr
      WHERE 1=1
    `;

    const params = [];
    if (fromDate) {
      query += ` AND DATE(psr.created_at) >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      query += ` AND DATE(psr.created_at) <= ?`;
      params.push(toDate);
    }

    query += ` ORDER BY psr.created_at DESC`;

    const [requests] = await db.execute(query, params);

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching stock requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock requests" },
      { status: 500 }
    );
  }
}

// POST - Create new stock request
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const username = payload.username;

    const formData = await req.formData();
    const db = await getDbConnection();

    // Extract form fields
    const product_code = formData.get("product_code");
    const product_name = formData.get("product_name");
    const specification = formData.get("specification");
    const hsn = formData.get("hsn");
    const unit = formData.get("unit");
    const gst_rate = formData.get("gst_rate");
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
    const customer_id = formData.get("customer_id");
    const client_name = formData.get("client_name");
    const client_company_name = formData.get("client_company_name");
    const client_number = formData.get("client_number");
    const client_email = formData.get("client_email");
    const client_gstin = formData.get("client_gstin");
    const customer_address = formData.get("customer_address");
    
    // Conditional transport fields
    const self_name = formData.get("self_name");
    const courier_tracking_id = formData.get("courier_tracking_id");
    const courier_company = formData.get("courier_company");
    const porter_tracking_id = formData.get("porter_tracking_id");
    const porter_contact = formData.get("porter_contact");
    const truck_number = formData.get("truck_number");
    const driver_name = formData.get("driver_name");
    const driver_number = formData.get("driver_number");

    // Handle file uploads
    const quotation_upload = await saveFile(formData.get("quotation_upload"));
    const payment_proof_upload = await saveFile(formData.get("payment_proof_upload"));
    const invoice_upload = await saveFile(formData.get("invoice_upload"));
    const product_image = await saveFile(formData.get("product_image"));
    const eway_bill = await saveFile(formData.get("eway_bill"));

    if (!product_image) {
      return NextResponse.json(
        { error: "Product image is mandatory" },
        { status: 400 }
      );
    }

    // Duplicate guard: same user + same core request details still in 'requested'
    // Normalize text fields to avoid collation issues
    const norm = (s) => (s ?? '').toString().trim().toLowerCase();
    const product_code_n = norm(product_code);
    const from_company_n = norm(from_company);
    const delivery_location_n = norm(delivery_location);
    const contact_n = norm(contact);
    const mode_of_transport_n = norm(mode_of_transport);

    const [[dup]] = await db.execute(
      `SELECT id FROM product_stock_request
        WHERE created_by = ?
          AND LOWER(TRIM(product_code)) = ?
          AND quantity = ?
          AND LOWER(TRIM(COALESCE(from_company, ''))) = ?
          AND LOWER(TRIM(COALESCE(delivery_location, ''))) = ?
          AND LOWER(TRIM(COALESCE(contact, ''))) = ?
          AND LOWER(TRIM(COALESCE(mode_of_transport, ''))) = ?
          AND status = 'requested'
        LIMIT 1`,
      [
        username,
        product_code_n,
        Number(quantity ?? 0),
        from_company_n,
        delivery_location_n,
        contact_n,
        mode_of_transport_n,
      ]
    );
    if (dup && dup.id) {
      return NextResponse.json(
        { error: "Duplicate stock request detected for the same product and details." },
        { status: 409 }
      );
    }

    // Insert into database
    const query = `
      INSERT INTO product_stock_request (
        product_code, product_name, specification, hsn, unit,
        gst_rate, quantity, price_per_unit, amount_per_unit, net_amount, transportation_charges,
        gst_toggle, tax_amount, quotation_upload, payment_proof_upload, invoice_upload,
        product_image, eway_bill, from_company, from_address, delivery_location, contact,
        mode_of_transport, self_name, courier_tracking_id, courier_company,
        porter_tracking_id, porter_contact, truck_number, driver_name, driver_number,
        customer_id, client_name, client_company_name, client_number, client_email, client_gstin, customer_address,
        status, created_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        'requested', ?
      )
    `;

    const values = [
      product_code, product_name, specification, hsn, unit,
      gst_rate, quantity, price_per_unit, amount_per_unit, net_amount, transportation_charges,
      gst_toggle, tax_amount, quotation_upload, payment_proof_upload, invoice_upload,
      product_image, eway_bill, from_company, from_address, delivery_location, contact,
      mode_of_transport, self_name, courier_tracking_id, courier_company,
      porter_tracking_id, porter_contact, truck_number, driver_name, driver_number,
      customer_id, client_name, client_company_name, client_number, client_email, client_gstin, customer_address,
      username
    ];

    const [result] = await db.execute(query, values);

    return NextResponse.json({
      success: true,
      message: "Stock request created successfully",
      requestId: result.insertId
    });
  } catch (error) {
    console.error("Error creating stock request:", error);
    return NextResponse.json(
      { error: "Failed to create stock request" },
      { status: 500 }
    );
  }
}
