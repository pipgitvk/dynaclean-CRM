import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const config = { api: { bodyParser: false } };

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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
    const conn = await getDbConnection();
    const sql = `INSERT INTO warranty_products
      (product_name, specification, model, serial_number, gstin, warranty_period,
       customer_name, email, contact, customer_address, state, invoice_number,
       invoice_date, invoice_file, report_file, quantity, contact_person,
       created_by, created_at, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    // await conn.execute(sql, [
    //   f.product_name, f.specification, f.model, f.serial_number, f.gstin,
    //   f.warranty_period, f.customer_name, f.email, f.contact, f.customer_address,
    //   f.invoice_number, f.invoice_date, invoiceFilename,
    //   reportNames.join(","), f.quantity, f.contact_person
    // ]);

    const now = new Date();
    const values = [
      f.product_name, f.specification, f.model, f.serial_number, f.gstin || "",
      f.warranty_period, f.customer_name, f.email, f.contact, f.customer_address,
      f.state || "", f.invoice_number, f.invoice_date, invoiceFilename,
      reportNames.join(","), f.quantity, f.contact_person,
      username, now, null, null
    ].map((v) => (v === undefined ? null : v));

    await conn.execute(sql, values);
    console.log("Form Data:", f);


    // await conn.end();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in POST /api/warranty/register:", err);
    return NextResponse.json({ success: false, error: err.message || "Unknown error" }, { status: 500 });
  }
}
