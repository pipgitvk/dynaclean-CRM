import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const conn = await getDbConnection();
    console.log("check this connection:", conn);

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,

        quotation_id INT NOT NULL,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,

        invoice_date DATE NOT NULL,
        due_date DATE NULL,

        total_amount DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) NOT NULL,
        grand_total DECIMAL(10,2) NOT NULL,

        status ENUM('draft','sent','paid','cancelled') DEFAULT 'draft',
        quote_number VARCHAR(50) NOT NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX (quotation_id)
      );
    `;

    await conn.execute(createTableQuery);

    return NextResponse.json({
      success: true,
      message: "Invoice table created successfully",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// generate and store invoices

export async function POST(req) {
  try {
    const { quoteNumber } = await req.json();

    if (!quoteNumber) {
      return NextResponse.json(
        { error: "quoteNumber is required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();

    // 1️⃣ Fetch quotation header
    const [[header]] = await conn.execute(
      `SELECT 
         \`S.No.\` AS quotation_id,
         subtotal,
         gst,
         grand_total
       FROM quotations_records
       WHERE quote_number = ?`,
      [quoteNumber],
    );

    if (!header) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 },
      );
    }

    // 2️⃣ Prevent duplicate invoice
    const [[existing]] = await conn.execute(
      "SELECT id FROM invoices WHERE quotation_id = ?",
      [header.quotation_id],
    );

    if (existing) {
      return NextResponse.json(
        { error: "Invoice already generated for this quotation" },
        { status: 409 },
      );
    }

    // 3️⃣ Generate invoice number
    const year = new Date().getFullYear();
    const invoiceNumber = `INV${year}${Date.now()}`;

    // 4️⃣ Insert invoice
    const [result] = await conn.execute(
      `INSERT INTO invoices (
        quotation_id,
        invoice_number,
        invoice_date,
        due_date,
        total_amount,
        tax_amount,
        grand_total,
        status,
        quote_number
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        header.quotation_id,
        invoiceNumber,
        new Date(),
        null,
        header.subtotal,
        header.gst,
        header.grand_total,
        "draft",
        quoteNumber,
      ],
    );

    return NextResponse.json({
      success: true,
      message: "Invoice generated successfully",
      invoiceId: result.insertId,
      invoiceNumber,
    });
  } catch (error) {
    console.error("Invoice generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
