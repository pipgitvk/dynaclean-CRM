import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import fs from "fs";
import { verifyManualPaymentsApiAccess } from "@/lib/manualPaymentsAccess";

const UPLOAD_DIR = path.join(process.cwd(), "public", "payment_invoices");

// GET: Fetch single payment entry by ID
export async function GET(request, { params }) {
  try {
    const auth = await verifyManualPaymentsApiAccess(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    console.log("id for manual ", id);
    const conn = await getDbConnection();

    const [rows] = await conn.execute(
      "SELECT * FROM manual_payment_pending WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Payment entry not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("❌ Error fetching payment entry:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 },
    );
  }
}

// PUT: Update existing payment entry
export async function PUT(request, { params }) {
  try {
    const auth = await verifyManualPaymentsApiAccess(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const formData = await request.formData();

    const conn = await getDbConnection();

    // Check if entry exists
    const [existing] = await conn.execute(
      "SELECT * FROM manual_payment_pending WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Payment entry not found" },
        { status: 404 },
      );
    }

    const currentEntry = existing[0];

    // Extract fields
    const customerName = formData.get("customer_name");
    const customerPhone = formData.get("customer_phone");
    const customerEmail = formData.get("customer_email");
    const amount = formData.get("amount");
    const paymentType = formData.get("payment_type");
    const paymentMethod = formData.get("payment_method");
    const referenceNumber = formData.get("reference_number");
    const paymentDate = formData.get("payment_date");
    const dueDate = formData.get("due_date");
    const status = formData.get("status");
    const remarks = formData.get("remarks");
    const invoiceFile = formData.get("invoice_file");
    const removeInvoice = formData.get("remove_invoice") === "true";

    let invoiceFilePath = currentEntry.invoice_file;

    // Handle invoice file removal
    if (removeInvoice && currentEntry.invoice_file) {
      try {
        const oldFilePath = path.join(
          process.cwd(),
          "public",
          currentEntry.invoice_file,
        );
        if (fs.existsSync(oldFilePath)) {
          await unlink(oldFilePath);
        }
        invoiceFilePath = null;
      } catch (fileError) {
        console.error("Error deleting old invoice:", fileError);
      }
    }

    // Handle new file upload
    if (
      invoiceFile &&
      typeof invoiceFile === "object" &&
      invoiceFile.size > 0
    ) {
      await mkdir(UPLOAD_DIR, { recursive: true });

      // Delete old file if exists
      if (currentEntry.invoice_file) {
        try {
          const oldFilePath = path.join(
            process.cwd(),
            "public",
            currentEntry.invoice_file,
          );
          if (fs.existsSync(oldFilePath)) {
            await unlink(oldFilePath);
          }
        } catch (fileError) {
          console.error("Error deleting old invoice:", fileError);
        }
      }

      const timestamp = Date.now();
      const fileExt = path.extname(invoiceFile.name).slice(0, 16);
      const fileName = `invoice_${timestamp}${fileExt}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      const buffer = Buffer.from(await invoiceFile.arrayBuffer());

      await writeFile(filePath, buffer);
      invoiceFilePath = `/payment_invoices/${fileName}`;
    }

    // Update the entry
    await conn.execute(
      `UPDATE manual_payment_pending SET
        customer_name = ?, customer_phone = ?, customer_email = ?, amount = ?,
        payment_type = ?, payment_method = ?, reference_number = ?, invoice_file = ?,
        payment_date = ?, due_date = ?, status = ?, remarks = ?,
        modified_by = ?, modified_at = NOW()
       WHERE id = ?`,
      [
        customerName,
        customerPhone,
        customerEmail,
        amount,
        paymentType,
        paymentMethod,
        referenceNumber,
        invoiceFilePath,
        paymentDate,
        dueDate,
        status,
        remarks,
        auth.username,
        id,
      ],
    );

    return NextResponse.json({
      success: true,
      message: "Payment entry updated successfully",
    });
  } catch (error) {
    console.error("❌ Error updating payment entry:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 },
    );
  }
}

// DELETE: Delete payment entry (soft delete)
export async function DELETE(request, { params }) {
  try {
    const auth = await verifyManualPaymentsApiAccess(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!["ADMIN", "SUPERADMIN"].includes(String(auth.role || "").toUpperCase())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const conn = await getDbConnection();

    // Check if entry exists
    const [existing] = await conn.execute(
      "SELECT * FROM manual_payment_pending WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Payment entry not found" },
        { status: 404 },
      );
    }

    // Soft delete by setting status to cancelled
    await conn.execute(
      `UPDATE manual_payment_pending SET
        status = 'cancelled',
        modified_by = ?,
        modified_at = NOW()
       WHERE id = ?`,
      [auth.username, id],
    );

    return NextResponse.json({
      success: true,
      message: "Payment entry deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting payment entry:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 },
    );
  }
}
