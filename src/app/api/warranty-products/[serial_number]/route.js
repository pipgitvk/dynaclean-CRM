// app/api/warranty-products/[serial_number]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";

// GET handler to fetch a single warranty product by serial number
export async function GET(req, { params }) {
  console.log("backend", params);
  const serialNumber = params.serial_number;
  if (!serialNumber) {
    // This case should ideally not happen if the route is correctly accessed
    // via /[serial_number], but kept for robustness.
    return NextResponse.json(
      { error: "Serial number is required." },
      { status: 400 },
    );
  }

  let conn;
  try {
    conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT * FROM warranty_products WHERE serial_number = ?`,
      [serialNumber],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Error fetching warranty product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product." },
      { status: 500 },
    );
  } finally {
    console.log(`[GET] DB connection closed`);
  }
}

// PUT handler to update a warranty product
export async function PUT(req, { params }) {
  const serialNumber = params.serial_number; // This is the original serial_number from the URL
  if (!serialNumber) {
    return NextResponse.json(
      { error: "Serial number for update is required." },
      { status: 400 },
    );
  }

  let conn;
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const username = payload.username || "unknown";

    const formData = await req.formData();

    // Extract all form fields
    const product_name = formData.get("product_name");
    const specification = formData.get("specification");
    const model = formData.get("model");
    const new_serial_number = formData.get("serial_number"); // The potentially new serial number from form
    const warranty_period = formData.get("warranty_period");
    const quantity = formData.get("quantity");
    const customer_name = formData.get("customer_name");
    const email = formData.get("email");
    const contact_person = formData.get("contact_person");
    const contact = formData.get("contact");
    const customer_address = formData.get("customer_address");
    const state = formData.get("state");
    const installed_address = formData.get("installed_address");
    const installation_date = formData.get("installation_date");
    const invoice_number = formData.get("invoice_number");
    const invoice_date = formData.get("invoice_date");
    const site_person = formData.get("site_person");
    const site_email = formData.get("site_email");
    const lat = formData.get("lat");
    const longt = formData.get("longt"); // Corrected from 'long' to 'longt' based on your PHP DB usage
    const site_contact = formData.get("site_contact");
    const gstin = formData.get("gstin"); // Added from PHP form

    // Validate required fields
    if (
      !product_name ||
      !new_serial_number ||
      !warranty_period ||
      !customer_name ||
      !email ||
      !contact ||
      !invoice_number ||
      !invoice_date
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 },
      );
    }

    conn = await getDbConnection();

    const uploadDirectory = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDirectory, { recursive: true });

    // Fetch existing data to retain old file names if new files aren't uploaded
    const [existingRows] = await conn.execute(
      `SELECT invoice_file, report_file FROM warranty_products WHERE serial_number = ?`,
      [serialNumber],
    );
    const existingInvoiceFile = existingRows[0]?.invoice_file || "";
    const existingReportFiles = existingRows[0]?.report_file
      ? existingRows[0].report_file.split(",").filter(Boolean)
      : [];

    let finalInvoiceFileName = existingInvoiceFile;
    const invoiceFile = formData.get("invoice_file"); // This will be a File object

    if (invoiceFile && invoiceFile.size > 0) {
      const fileExtension = path.extname(invoiceFile.name);
      const baseFilename = path.basename(invoiceFile.name, fileExtension);
      const uniqueFilename = `${baseFilename}_${Date.now()}_${Math.floor(Math.random() * 10000)}${fileExtension}`;
      const filePath = path.join(uploadDirectory, uniqueFilename);
      const buffer = Buffer.from(await invoiceFile.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      finalInvoiceFileName = uniqueFilename;
    }

    let newReportFiles = [];
    const serviceReports = formData.getAll("service_reports"); // This will be an array of File objects

    for (const file of serviceReports) {
      if (file && file.size > 0) {
        const fileExtension = path.extname(file.name);
        const baseFilename = path.basename(file.name, fileExtension);
        const uniqueFilename = `${baseFilename}_${Date.now()}_${Math.floor(Math.random() * 10000)}${fileExtension}`;
        const filePath = path.join(uploadDirectory, uniqueFilename);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);
        newReportFiles.push(uniqueFilename);
      }
    }

    // Combine existing and new report files. Remove duplicates.
    const combinedReportFiles = [
      ...new Set([...existingReportFiles, ...newReportFiles]),
    ];
    const finalReportFileNames = combinedReportFiles.join(",");

    const sql = `
      UPDATE warranty_products
      SET
        product_name = ?,
        specification = ?,
        model = ?,
        serial_number = ?,
        warranty_period = ?,
        quantity = ?,
        customer_name = ?,
        email = ?,
        contact_person = ?,
        contact = ?,
        customer_address = ?,
        state = ?,
        installed_address = ?,
        installation_date = ?,
        invoice_number = ?,
        invoice_date = ?,
        site_person = ?,
        site_email = ?,
        lat = ?,
        longt = ?,
        site_contact = ?,
        gstin = ?,
        invoice_file = ?,
        report_file = ?,
        updated_by = ?,
        updated_at = ?
      WHERE serial_number = ?
    `;

    const values = [
      product_name,
      specification,
      model,
      new_serial_number, // Use the new serial number from the form for update
      warranty_period,
      quantity,
      customer_name,
      email,
      contact_person,
      contact,
      customer_address,
      state,
      installed_address,
      installation_date || null, // Handle empty date
      invoice_number,
      invoice_date,
      site_person,
      site_email,
      lat,
      longt,
      site_contact,
      gstin,
      finalInvoiceFileName,
      finalReportFileNames,
      username,
      new Date(),
      serialNumber, // Use the original serial number from URL for WHERE clause
    ];

    await conn.execute(sql, values);

    return NextResponse.json({
      success: true,
      message: "Product warranty updated successfully!",
    });
  } catch (error) {
    console.error("Error updating product warranty:", error);
    return NextResponse.json(
      { error: "Failed to update product warranty.", details: error.message },
      { status: 500 },
    );
  } finally {
    console.log(`[GET] DB connection closed`);
  }
}
