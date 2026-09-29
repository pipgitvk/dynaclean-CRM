import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getDbConnection } from "@/lib/db";
import { verifyManualPaymentsApiAccess } from "@/lib/manualPaymentsAccess";
import { ensureManualPaymentReceivedTable } from "@/lib/ensureManualPaymentReceivedTable";

const UPLOAD_DIR = path.join(process.cwd(), "public", "payment_received");

function canEditReceivedPayment(role) {
  const key = String(role || "").trim().toUpperCase();
  if (key === "SUPERADMIN" || key === "ACCOUNTANT" || key === "ADMIN") return true;
  return /\bACCOUNTANT\b/.test(key);
}

export async function PUT(request, { params }) {
  try {
    const auth = await verifyManualPaymentsApiAccess(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!canEditReceivedPayment(auth.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id, receivedId } = await params;
    const formData = await request.formData();
    const paymentDate = formData.get("payment_date");
    const referenceNumber = formData.get("reference_number");
    const amount = formData.get("amount");
    const attachment = formData.get("attachment");

    if (!paymentDate || amount === null || amount === "") {
      return NextResponse.json(
        { error: "Payment date and amount are required" },
        { status: 400 },
      );
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    await ensureManualPaymentReceivedTable();
    const conn = await getDbConnection();

    const [[payment]] = await conn.execute(
      "SELECT * FROM manual_payment_pending WHERE id = ? LIMIT 1",
      [id],
    );
    if (!payment) {
      return NextResponse.json({ error: "Payment entry not found" }, { status: 404 });
    }

    const [[existing]] = await conn.execute(
      "SELECT * FROM manual_payment_received WHERE id = ? AND payment_id = ? LIMIT 1",
      [receivedId, id],
    );
    if (!existing) {
      return NextResponse.json({ error: "Received payment not found" }, { status: 404 });
    }

    let attachmentPath = existing.attachment_file;
    if (attachment && typeof attachment === "object" && attachment.size > 0) {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const timestamp = Date.now();
      const fileExt = path.extname(attachment.name).slice(0, 16);
      const fileName = `received_${id}_${timestamp}${fileExt}`;
      await writeFile(
        path.join(UPLOAD_DIR, fileName),
        Buffer.from(await attachment.arrayBuffer()),
      );
      attachmentPath = `/payment_received/${fileName}`;
    }

    await conn.execute(
      `UPDATE manual_payment_received
       SET payment_date = ?, reference_number = ?, amount = ?, attachment_file = ?
       WHERE id = ? AND payment_id = ?`,
      [
        paymentDate,
        referenceNumber || null,
        parsedAmount,
        attachmentPath,
        receivedId,
        id,
      ],
    );

    const [[sumRow]] = await conn.execute(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM manual_payment_received WHERE payment_id = ?",
      [id],
    );
    const totalReceived = Number(sumRow?.total || 0);
    const pendingAmount = Number(payment.amount || 0);
    let status = payment.status;
    if (String(status || "").toLowerCase() !== "cancelled") {
      if (pendingAmount > 0 && totalReceived >= pendingAmount) status = "received";
      else if (String(status || "").toLowerCase() === "received") status = "pending";
    }

    if (status !== payment.status) {
      await conn.execute(
        `UPDATE manual_payment_pending
         SET status = ?, modified_by = ?, modified_at = NOW()
         WHERE id = ?`,
        [status, auth.username, id],
      );
    }

    return NextResponse.json({
      success: true,
      message: "Received payment updated",
      total_received: totalReceived,
      status,
    });
  } catch (error) {
    console.error("❌ Error updating received payment:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 },
    );
  }
}
