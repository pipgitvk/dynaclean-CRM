import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

// GET - Fetch all purchase products
export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const conn = await getDbConnection();

    // Ensure table exists
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS product_stock_request (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_number VARCHAR(255),
          product_name VARCHAR(255),
          from_company VARCHAR(255),
          net_amount DECIMAL(12, 2),
          quantity INT,
          price_per_unit DECIMAL(12, 2),
          tax_amount DECIMAL(12, 2),
          invoice_date DATE,
          status ENUM('requested','in_warehouse','fulfilled') DEFAULT 'requested',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_invoice_number (invoice_number),
          INDEX idx_status (status),
          INDEX idx_from_company (from_company)
        )
      `);
    } catch (e) {
      // Table might already exist
    }

    let query = `
      SELECT 
        id,
        invoice_number as invoice_no,
        from_company as vendor_name,
        product_name,
        product_code,
        net_amount as amount,
        quantity,
        price_per_unit as unit_price,
        tax_amount as gst_amount,
        invoice_date as purchase_date,
        status,
        customer_id,
        client_name,
        client_company_name,
        client_number,
        client_email,
        client_gstin,
        customer_address,
        payment_entries,
        terms_id,
        delivery_location,
        mode_of_transport,
        transportation_charges,
        self_name,
        courier_tracking_id,
        courier_company,
        porter_tracking_id,
        porter_contact,
        truck_number,
        driver_name,
        driver_number,
        eway_bill,
        product_image,
        invoice_upload,
        payment_proof_upload,
        quotation_upload,
        created_at,
        updated_at
      FROM product_stock_request 
      WHERE 1=1 AND invoice_number IS NOT NULL AND invoice_number != ''
    `;
    const params = [];

    if (fromDate) {
      query += ` AND invoice_date >= ?`;
      params.push(fromDate);
    }

    if (toDate) {
      query += ` AND invoice_date <= ?`;
      params.push(toDate);
    }

    query += " ORDER BY invoice_date DESC";

    const [rows] = await conn.execute(query, params);

    // Group by invoice number to combine duplicate entries
    const grouped = {};
    const rawData = rows || [];
    
    rawData.forEach(row => {
      const invoiceNo = row.invoice_no;
      if (grouped[invoiceNo]) {
        // Combine products for same invoice
        const existingProducts = grouped[invoiceNo].product_name ? grouped[invoiceNo].product_name.split(', ') : [];
        const newProduct = row.product_name;
        if (newProduct && !existingProducts.includes(newProduct)) {
          existingProducts.push(newProduct);
          grouped[invoiceNo].product_name = existingProducts.join(', ');
        }
        
        // Sum amounts
        grouped[invoiceNo].amount = (Number(grouped[invoiceNo].amount) + Number(row.amount || 0)).toFixed(2);
        grouped[invoiceNo].gst_amount = (Number(grouped[invoiceNo].gst_amount || 0) + Number(row.gst_amount || 0)).toFixed(2);
        grouped[invoiceNo].quantity = (Number(grouped[invoiceNo].quantity || 0) + Number(row.quantity || 0)).toString();
        
        // Set status based on priority (fulfilled > in_warehouse > requested)
        if (row.status === 'fulfilled' || grouped[invoiceNo].status !== 'fulfilled') {
          grouped[invoiceNo].status = row.status;
        }
      } else {
        // First entry for this invoice - add status mapping
        grouped[invoiceNo] = { 
          ...row,
          // Map product_stock_request status to purchase status
          status: row.status === 'fulfilled' ? 'Paid' : 
                  row.status === 'in_warehouse' ? 'Partially Paid' : 'Unpaid'
        };
      }
    });

    // Convert back to array
    const groupedData = Object.values(grouped);

    return NextResponse.json({
      success: true,
      data: groupedData,
    });
  } catch (error) {
    console.error("Error fetching purchase products:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new purchase product
export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const body = await req.json();
    const {
      invoice_no,
      vendor_name,
      product_name,
      product_code,
      amount,
      status = "Unpaid",
      purchase_date,
      reference_no,
      quantity,
      unit_price,
      gst_amount,
      notes,
      payment_entries,
      terms_id,
      delivery_location,
      mode_of_transport,
      transportation_charges,
      self_name,
      courier_tracking_id,
      courier_company,
      porter_tracking_id,
      porter_contact,
      truck_number,
      driver_name,
      driver_number,
      // Customer details
      customer_id,
      client_name,
      client_company_name,
      client_number,
      client_email,
      client_gstin,
      customer_address,
      // Document uploads
      eway_bill,
      product_image,
      invoice_upload,
      payment_proof_upload,
      quotation_upload,
    } = body;

    if (!invoice_no || !vendor_name || !product_name || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Ensure table exists
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS product_stock_request (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_number VARCHAR(255),
          product_name VARCHAR(255),
          from_company VARCHAR(255),
          net_amount DECIMAL(12, 2),
          quantity INT,
          price_per_unit DECIMAL(12, 2),
          tax_amount DECIMAL(12, 2),
          invoice_date DATE,
          status ENUM('requested','in_warehouse','fulfilled') DEFAULT 'requested',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_invoice_number (invoice_number),
          INDEX idx_status (status),
          INDEX idx_from_company (from_company)
        )
      `);
    } catch (e) {
      // Table might already exist
    }

    const [result] = await conn.execute(
      `INSERT INTO product_stock_request (
        invoice_number, from_company, product_name, product_code, net_amount, 
        invoice_date, quantity, price_per_unit, tax_amount, status,
        customer_id, client_name, client_company_name, client_number, 
        client_email, client_gstin, customer_address, payment_entries, terms_id,
        delivery_location, mode_of_transport, transportation_charges,
        self_name, courier_tracking_id, courier_company, porter_tracking_id,
        porter_contact, truck_number, driver_name, driver_number,
        eway_bill, product_image, invoice_upload, payment_proof_upload, quotation_upload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice_no,
        client_company_name || vendor_name,
        product_name,
        product_code || null,
        amount,
        purchase_date || new Date().toISOString().split("T")[0],
        quantity || null,
        unit_price || null,
        gst_amount || null,
        status === 'Paid' ? 'fulfilled' : status === 'Partially Paid' ? 'in_warehouse' : 'requested',
        customer_id || null,
        client_name || null,
        client_company_name || null,
        client_number || null,
        client_email || null,
        client_gstin || null,
        customer_address || null,
        payment_entries || null,
        terms_id || null,
        delivery_location || null,
        mode_of_transport || null,
        transportation_charges != null ? Number(transportation_charges) : 0,
        self_name || null,
        courier_tracking_id || null,
        courier_company || null,
        porter_tracking_id || null,
        porter_contact || null,
        truck_number || null,
        driver_name || null,
        driver_number || null,
        eway_bill || null,
        product_image || null,
        invoice_upload || null,
        payment_proof_upload || null,
        quotation_upload || null,
      ]
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertId,
        invoice_no,
        vendor_name,
        product_name,
        product_code,
        amount,
        status,
        purchase_date,
        quantity,
        unit_price,
        gst_amount,
      },
    });
  } catch (error) {
    console.error("Error creating purchase product:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
