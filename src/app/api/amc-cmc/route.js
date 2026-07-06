import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page")) || 1;
  const limit = parseInt(searchParams.get("limit")) || 50;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";

  const offset = (page - 1) * limit;

  let conn;
  try {
    conn = await getDbConnection();

    let whereClause = "1=1";
    let params = [];

    if (search) {
      whereClause += " AND (serial_number LIKE ? OR company_name LIKE ? OR email LIKE ? OR contact LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }

    const [rows] = await conn.execute(
      `SELECT * FROM amc_cmc WHERE ${whereClause} ORDER BY created_time DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await conn.execute(
      `SELECT COUNT(*) as total FROM amc_cmc WHERE ${whereClause}`,
      params
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      amc_cmc: rows,
      total,
      totalPages,
      currentPage: page,
      pageSize: limit,
    });
  } catch (error) {
    console.error("Error fetching AMC/CMC records:", error);
    return NextResponse.json(
      { error: "Failed to fetch AMC/CMC records" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let conn;
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    const serial_number = formData.get("serial_number");
    const company_name = formData.get("company_name");
    const amc_start_datetime = formData.get("amc_start_datetime");
    const amc_end_datetime = formData.get("amc_end_datetime");

    // Validation
    if (!serial_number || !company_name || !amc_start_datetime || !amc_end_datetime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const startTime = new Date(amc_start_datetime);
    const endTime = new Date(amc_end_datetime);

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: "AMC end date must be greater than start date" },
        { status: 400 }
      );
    }

    const model = formData.get("model");
    const contact = formData.get("contact");
    const email = formData.get("email");
    const site_address = formData.get("site_address");
    const site_contact = formData.get("site_contact");
    const site_email = formData.get("site_email");
    const quotation_ref = formData.get("quotation_ref");
    const terms_and_conditions = formData.get("terms_and_conditions");

    conn = await getDbConnection();

    // Handle file uploads
    let image_filename = null;
    let invoice_filename = null;
    let payment_proof_filename = null;

    const { uploadFiles } = await import("@/lib/fileUpload");

    const imageFile = formData.get("image_at_the_time_of_amc");
    if (imageFile && imageFile.size > 0) {
      const result = await uploadFiles([imageFile], "amc_cmc");
      image_filename = result[0];
    }

    const invoiceFile = formData.get("invoice");
    if (invoiceFile && invoiceFile.size > 0) {
      const result = await uploadFiles([invoiceFile], "amc_cmc");
      invoice_filename = result[0];
    }

    const paymentFile = formData.get("payment_proof");
    if (paymentFile && paymentFile.size > 0) {
      const result = await uploadFiles([paymentFile], "amc_cmc");
      payment_proof_filename = result[0];
    }

    const [result] = await conn.execute(
      `INSERT INTO amc_cmc (
        serial_number, model, image_at_the_time_of_amc, company_name, contact, email,
        site_address, site_contact, site_email, amc_start_datetime, amc_end_datetime,
        quotation_ref, invoice, payment_proof, terms_and_conditions, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serial_number,
        model,
        image_filename,
        company_name,
        contact,
        email,
        site_address,
        site_contact,
        site_email,
        amc_start_datetime,
        amc_end_datetime,
        quotation_ref,
        invoice_filename,
        payment_proof_filename,
        terms_and_conditions,
        payload.username,
        "pending",
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: "AMC/CMC record created successfully",
        id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating AMC/CMC record:", error);
    return NextResponse.json(
      { error: "Failed to create AMC/CMC record", details: error.message },
      { status: 500 }
    );
  }
}
