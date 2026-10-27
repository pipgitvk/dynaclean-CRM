import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { verifyManualPaymentsApiAccess } from "@/lib/manualPaymentsAccess";
import {
  deleteManualPaymentInvoice,
  saveManualPaymentInvoice,
} from "@/lib/saveManualPaymentInvoice";

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
    const hasNewFile =
      invoiceFile &&
      typeof invoiceFile === "object" &&
      invoiceFile.size > 0;

    if (hasNewFile) {
      invoiceFilePath = await saveManualPaymentInvoice(invoiceFile);
      if (
        currentEntry.invoice_file &&
        currentEntry.invoice_file !== invoiceFilePath
      ) {
        await deleteManualPaymentInvoice(currentEntry.invoice_file);
      }
    } else if (removeInvoice && currentEntry.invoice_file) {
      await deleteManualPaymentInvoice(currentEntry.invoice_file);
      invoiceFilePath = null;
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
