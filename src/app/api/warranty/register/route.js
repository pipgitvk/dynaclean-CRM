import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const username = payload.username || "unknown";

    const formData = await req.formData();

    // Extract files
    const invoiceFile = formData.get("invoice");
    const reports = formData.getAll("service_reports");

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    let invoiceFilename = null;
    if (invoiceFile && invoiceFile.name) {
      invoiceFilename = `${Date.now()}-${invoiceFile.name}`;
      const invoiceBuffer = Buffer.from(await invoiceFile.arrayBuffer());
      const invoicePath = path.join(uploadsDir, invoiceFilename);
      await fs.writeFile(invoicePath, invoiceBuffer);
      console.log(`Saved invoice: ${invoicePath}`);
    } else {
      console.log("No invoice file uploaded");
    }

    const reportNames = [];
    for (const report of reports) {
      if (report && report.name) {
        const reportFilename = `${Date.now()}-${report.name}`;
        const reportBuffer = Buffer.from(await report.arrayBuffer());
        const reportPath = path.join(uploadsDir, reportFilename);
        await fs.writeFile(reportPath, reportBuffer);
        reportNames.push(reportFilename);
        console.log(`Saved report: ${reportPath}`);
      } else {
        console.log("Skipping invalid report file:", report);
      }
    }

    // Insert form data to DB
    const f = Object.fromEntries(formData.entries());
    
    // Validation: Check for all required fields
    const requiredFields = {
      product_name: f.product_name?.trim(),
      serial_number: f.serial_number?.trim(),
      warranty_period: f.warranty_period?.toString().trim(),
      customer_name: f.customer_name?.trim(),
      email: f.email?.trim(),
      contact_person: f.contact_person?.trim(),
      contact: f.contact?.toString().trim(),
      customer_address: f.customer_address?.trim(),
      state: f.state?.trim(),
      invoice_number: f.invoice_number?.trim(),
      invoice_date: f.invoice_date?.trim(),
    };

    // Check if any required fields are empty
    const missingFields = Object.keys(requiredFields).filter(
      (key) => !requiredFields[key]
    );

    if (missingFields.length > 0) {
      console.error("Missing required fields:", missingFields);
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^\S+@\S+$/i;
    if (!emailRegex.test(f.email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Warranty period validation
    const warrantyPeriod = parseInt(f.warranty_period);
    if (isNaN(warrantyPeriod) || warrantyPeriod < 0) {
      return NextResponse.json(
        { success: false, error: "Warranty period must be a positive number" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const sql = `INSERT INTO warranty_products
      (product_name, specification, model, serial_number, gstin, warranty_period,
       customer_name, email, contact, customer_address, state, invoice_number,
       invoice_date, invoice_file, report_file, quantity, contact_person,
       created_by, created_at, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const now = new Date();
    const values = [
      f.product_name,
      f.specification,
      f.model,
      f.serial_number,
      f.gstin || "",
      f.warranty_period,
      f.customer_name,
      f.email,
      f.contact,
      f.customer_address,
      f.state || "",
      f.invoice_number,
      f.invoice_date,
      invoiceFilename,
      reportNames.join(","),
      f.quantity,
      f.contact_person,
      username,
      now,
      null,
      null,
    ].map((v) => (v === undefined ? null : v));

    await conn.execute(sql, values);
    console.log("Form Data:", f);

    // await conn.end();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in POST /api/warranty/register:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
