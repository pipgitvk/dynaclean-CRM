import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request, { params }) {
  const { id } = await params;

  let conn;
  try {
    conn = await getDbConnection();

    const [rows] = await conn.execute(
      "SELECT * FROM amc_cmc WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "AMC/CMC record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("Error fetching AMC/CMC record:", error);
    return NextResponse.json(
      { error: "Failed to fetch AMC/CMC record" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;

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

    conn = await getDbConnection();

    const [existing] = await conn.execute(
      "SELECT * FROM amc_cmc WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "AMC/CMC record not found" },
        { status: 404 }
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

    let image_filename = existing[0].image_at_the_time_of_amc;
    let invoice_filename = existing[0].invoice;
    let payment_proof_filename = existing[0].payment_proof;

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

    await conn.execute(
      `UPDATE amc_cmc SET
        serial_number = ?, model = ?, image_at_the_time_of_amc = ?, company_name = ?,
        contact = ?, email = ?, site_address = ?, site_contact = ?, site_email = ?,
        amc_start_datetime = ?, amc_end_datetime = ?, quotation_ref = ?, invoice = ?,
        payment_proof = ?, terms_and_conditions = ?
      WHERE id = ?`,
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
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "AMC/CMC record updated successfully",
    });
  } catch (error) {
    console.error("Error updating AMC/CMC record:", error);
    return NextResponse.json(
      { error: "Failed to update AMC/CMC record", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  let conn;
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    conn = await getDbConnection();

    const [existing] = await conn.execute(
      "SELECT * FROM amc_cmc WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "AMC/CMC record not found" },
        { status: 404 }
      );
    }

    await conn.execute("DELETE FROM amc_cmc WHERE id = ?", [id]);

    return NextResponse.json({
      success: true,
      message: "AMC/CMC record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting AMC/CMC record:", error);
    return NextResponse.json(
      { error: "Failed to delete AMC/CMC record" },
      { status: 500 }
    );
  }
}
