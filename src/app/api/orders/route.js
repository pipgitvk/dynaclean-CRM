import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { parseFormData } from "@/lib/parseForm";
import fs from "fs/promises"; // Use fs.promises for async file operations
import path from "path";
import { sendTemplatedEmail } from "@/lib/template-utils";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Helper function to save a file locally
async function saveFileLocally(file, subfolder) {
  if (!file || !file.filepath || !file.originalFilename) {
    console.warn("⚠️ File missing or invalid for local save:", file);
    throw new Error("File is missing or invalid");
  }

  // Create subfolder if it doesn't exist (e.g., 'uploads/po_files', 'uploads/payment_files')
  const targetSubfolder = path.join(UPLOAD_DIR, subfolder);
  await fs.mkdir(targetSubfolder, { recursive: true });

  const fileName = `${Date.now()}-${file.originalFilename}`; // Ensure unique filename
  const targetPath = path.join(targetSubfolder, fileName);

  try {
    // Read the file content from the temporary path and write to the target path
    const fileContent = await fs.readFile(file.filepath);
    await fs.writeFile(targetPath, fileContent);
    console.log("✅ File saved locally:", targetPath);

    // Return the relative URL path that can be accessed via the browser
    return `/uploads/${subfolder}/${fileName}`;
  } finally {
    // Clean up the temporary file created by formidable
    await fs.unlink(file.filepath).catch((err) => {
      console.error("Failed to delete temp file:", err);
    });
  }
}

function generateOrderId(todayCount) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return date + String(todayCount + 1).padStart(3, "0");
}

export async function POST(req) {
  try {
    // 1. Authenticate
    const token = req.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    );
    const username = payload.username;
    const userRole = payload.role; // Assuming role is in JWT as per login/route.js

    // 2. Parse multipart/form-data
    const { fields, files } = await parseFormData(req);
    // Normalize field values from [ 'value' ] → 'value'
    for (const key in fields) {
      if (Array.isArray(fields[key])) {
        fields[key] = fields[key][0];
      }
    }

    console.log("📦 Parsed Fields:", fields);
    console.log("📁 Parsed Files:", files);

    const {
      quote_number,
      client_name,
      phone,
      email,
      delivery_location,
      company_name,
      company_address,
      state,
      ship_to,
      salesRemark,
      clientDeliveryDate,
    } = fields;

    // Validate mandatory fields
    if (!salesRemark || salesRemark.trim() === "") {
      return NextResponse.json(
        { error: "Remark is required" },
        { status: 400 },
      );
    }

    if (!files.paymentProof || !files.paymentProof[0]) {
      return NextResponse.json(
        { error: "Payment Proof is required" },
        { status: 400 },
      );
    }

    // 3. Save files locally instead of uploading to Cloudinary
    let poFileUrl = "";
    if (files.poFile && files.poFile[0]) {
      poFileUrl = await saveFileLocally(files.poFile[0], "po_files");
    }

    let paymentProofUrl = "";
    if (files.paymentProof && files.paymentProof[0]) {
      paymentProofUrl = await saveFileLocally(
        files.paymentProof[0],
        "payment_files",
      );
    }

    // 4. Approval Logic
    const isAutoApproved = ["SUPERADMIN", "ADMIN"].includes(userRole);
    const approvalStatus = isAutoApproved ? "approved" : "pending";
    const salesStatus = isAutoApproved ? 1 : 0;

    // 5. Insert into DB
    const conn = await getDbConnection();

    const [[{ count }]] = await conn.execute(
      "SELECT COUNT(*) AS count FROM neworder WHERE DATE(created_at) = CURDATE()",
    );
    const orderId = generateOrderId(count);
    // console.log("Generated Order ID:", orderId);

    // Compute duedate = (client may send) OR today + payment_term_days from quotation
    let duedateISO = fields.duedate;
    if (!duedateISO) {
      let days = 0;
      if (quotation && quotation.payment_term_days) {
        days = Number(quotation.payment_term_days) || 0;
      } else {
        // attempt to fetch from quotations_records
        const [qRows] = await conn.execute(
          `SELECT payment_term_days FROM quotations_records WHERE quote_number = ? LIMIT 1`,
          [quote_number],
        );
        days =
          (Array.isArray(qRows) &&
            qRows.length &&
            Number(qRows[0]?.payment_term_days)) ||
          0;
      }
      const today = new Date();
      const due = new Date(today);
      due.setDate(due.getDate() + days);
      duedateISO = due.toISOString().slice(0, 10);
    }

    // console here
    console.log("INSERT PARAMS", {
      quote_number,
      client_name,
      phone,
      email,
      delivery_location: "",
      company_name,
      company_address,
      state,
      ship_to,
    });

    const [result] = await conn.execute(
      `INSERT INTO neworder
         (order_id, quote_number, po_file, payment_proof, client_name,
          contact, email, delivery_location, company_name, company_address,
          state, sales_status, sales_remark, ship_to, created_by, duedate, client_delivery_date, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        quote_number,
        poFileUrl,
        paymentProofUrl,
        client_name,
        phone,
        email,
        delivery_location,
        company_name,
        company_address,
        state,
        salesStatus,
        salesRemark,
        ship_to,
        username,
        duedateISO,
        clientDeliveryDate || null,
        approvalStatus,
      ],
    );

    // 6. Send Email if pending approval
    if (approvalStatus === "pending") {
      try {
        const adminEmail = "piptrade8@gmail.com";
        if (adminEmail) {
          await sendTemplatedEmail(
            "ORDER_APPROVAL",
            {
              order_id: orderId,
              quote_number: quote_number,
              company_name: company_name,
              delivery_location: delivery_location,
              client_name: client_name,
              created_by: username,
              status: "Pending Approval",
            },
            {
              to: adminEmail,
              // Custom SMTP for approval emails
              auth: {
                user: "neha.s",
                pass: "tl~{9gBU^1ysVTXW", // User provided this pass in a way that suggests it's for this specific use case
              },
            },
          );
        }
      } catch (emailErr) {
        console.error("⚠️ Failed to send approval email:", emailErr);
      }
    }

    // Seed dispatch rows per quantity from quotation items
    // 1) Ensure dispatch table exists
    await conn.execute(`CREATE TABLE IF NOT EXISTS dispatch (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quote_number VARCHAR(100) NOT NULL,
      item_name VARCHAR(255) DEFAULT NULL,
      item_code VARCHAR(100) DEFAULT NULL,
      serial_no VARCHAR(255) DEFAULT NULL,
      remarks TEXT DEFAULT NULL,
      photos TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL,
      INDEX idx_quote_number (quote_number),
      INDEX idx_item_code (item_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // 2) Get quotation items for this quote
    const [quotationItems] = await conn.execute(
      `SELECT item_name, item_code, quantity FROM quotation_items WHERE quote_number = ?`,
      [quote_number],
    );

    // 3) Insert dispatch rows for each item based on quantity
    for (const item of quotationItems) {
      const { item_name, item_code, quantity } = item;
      const qty = Number(quantity) || 0;

      if (qty > 0) {
        const placeholders = Array.from({ length: qty })
          .map(() => "(?, ?, ?, NULL, NULL, NULL, NOW(), NULL)")
          .join(",");
        const params = [];
        for (let i = 0; i < qty; i++) {
          params.push(quote_number, item_name, item_code);
        }
        await conn.execute(
          `INSERT INTO dispatch (quote_number, item_name, item_code, serial_no, remarks, photos, created_at, updated_at) VALUES ${placeholders}`,
          params,
        );
      }
    }

    // conn.end();
    console.log("✅ Order saved successfully:", orderId);
    return NextResponse.json({ success: true, orderId }, { status: 201 });
  } catch (err) {
    console.error("❌ Order save error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
