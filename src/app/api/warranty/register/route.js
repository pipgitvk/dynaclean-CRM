import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureWarrantySpareColumns } from "@/lib/ensureWarrantySpareColumns";
import { insertRegisteredSpare } from "@/lib/insertRegisteredSpare";

const SPARE_INSTALLED_BY = new Set(["videocall", "self_customer", "on_site"]);

function isoDateOnly(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

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
    
    const itemKind = String(f.item_kind || "product").trim().toLowerCase();
    const isSpareRegistration = itemKind !== "product";

    // Validation: Check for all required fields
    const requiredFields = {
      product_name: f.product_name?.trim(),
      serial_number: f.serial_number?.trim(),
      customer_name: f.customer_name?.trim(),
      email: f.email?.trim(),
      contact_person: f.contact_person?.trim(),
      contact: f.contact?.toString().trim(),
      customer_address: f.customer_address?.trim(),
      state: f.state?.trim(),
      invoice_number: f.invoice_number?.trim(),
      invoice_date: f.invoice_date?.trim(),
    };

    if (!isSpareRegistration) {
      requiredFields.warranty_period = f.warranty_period?.toString().trim();
    } else {
      requiredFields.installed_by = String(f.installed_by || "").trim();
    }

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

    let warrantyPeriod = null;
    if (!isSpareRegistration) {
      warrantyPeriod = parseInt(f.warranty_period, 10);
      if (Number.isNaN(warrantyPeriod) || warrantyPeriod < 0) {
        return NextResponse.json(
          { success: false, error: "Warranty period must be a positive number" },
          { status: 400 },
        );
      }
    } else if (!SPARE_INSTALLED_BY.has(requiredFields.installed_by)) {
      return NextResponse.json(
        {
          success: false,
          error: "Installed by must be videocall, self customer, or on site",
        },
        { status: 400 },
      );
    }

    const installedBy = isSpareRegistration ? requiredFields.installed_by : null;

    let installationCompletedBy = null;
    let installationCompletedDate = null;
    let spareInstallationStatus = null;
    let installationDate = null;

    if (isSpareRegistration && requiredFields.installed_by === "videocall") {
      installationCompletedBy = String(f.installation_completed_by || "").trim();
      installationCompletedDate = String(
        f.installation_completed_date || "",
      ).trim();
      if (!installationCompletedBy || !installationCompletedDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Completed by (name) and completed date are required for videocall",
          },
          { status: 400 },
        );
      }
    }

    if (isSpareRegistration) {
      if (requiredFields.installed_by === "on_site") {
        spareInstallationStatus = "pending";
      } else {
        spareInstallationStatus = "completed";
        if (requiredFields.installed_by === "self_customer") {
          installationCompletedBy = String(f.contact_person || "Self customer").trim();
          installationCompletedDate = String(f.invoice_date || "").trim() || isoDateOnly();
        }
        installationDate =
          installationCompletedDate ||
          String(f.invoice_date || "").trim() ||
          isoDateOnly();
      }
    }

    const conn = await getDbConnection();
    await ensureWarrantySpareColumns(conn);
    const sql = `INSERT INTO warranty_products
      (product_name, specification, model, serial_number, gstin, warranty_period,
       customer_name, email, contact, customer_address, state, invoice_number,
       invoice_date, invoice_file, report_file, quantity, contact_person, installed_by,
       installation_completed_by, installation_completed_date, spare_installation_status,
       installation_date,
       created_by, created_at, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const now = new Date();
    const values = [
      f.product_name,
      f.specification,
      f.model,
      f.serial_number,
      f.gstin || "",
      warrantyPeriod,
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
      installedBy,
      installationCompletedBy,
      installationCompletedDate,
      spareInstallationStatus,
      installationDate,
      username,
      now,
      null,
      null,
    ].map((v) => (v === undefined ? null : v));

    const [insertResult] = await conn.execute(sql, values);
    const warrantyProductId = Number(insertResult?.insertId) || null;

    if (isSpareRegistration && warrantyProductId) {
      await insertRegisteredSpare(conn, {
        warrantyProductId,
        form: f,
        username,
        spareInstallationStatus,
        installationCompletedBy,
        installationCompletedDate,
      });
    }

    console.log("Form Data:", f);

    return NextResponse.json({
      success: true,
      spare_installation_status: spareInstallationStatus,
      warranty_product_id: warrantyProductId,
    });
  } catch (err) {
    console.error("Error in POST /api/warranty/register:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
