import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getDbConnection } from "@/lib/db";
import { verifyManualPaymentsApiAccess } from "@/lib/manualPaymentsAccess";
import { ensureManualPaymentReceivedTable } from "@/lib/ensureManualPaymentReceivedTable";

const UPLOAD_DIR = path.join(process.cwd(), "public", "payment_received");

const ACCOUNTS_ROLES = new Set(["ACCOUNTANT", "ADMIN", "SUPERADMIN"]);

async function getPaymentRow(conn, paymentId) {
  const [rows] = await conn.execute(
    "SELECT * FROM manual_payment_pending WHERE id = ? LIMIT 1",
    [paymentId],
  );
  return rows[0] || null;
}

async function getTotalReceived(conn, paymentId) {
  const [rows] = await conn.execute(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM manual_payment_received WHERE payment_id = ?",
    [paymentId],
  );
  return Number(rows[0]?.total || 0);
}

export async function GET(request, { params }) {
  try {
    const auth = await verifyManualPaymentsApiAccess(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    await ensureManualPaymentReceivedTable();
    const conn = await getDbConnection();

    const payment = await getPaymentRow(conn, id);
    if (!payment) {
      return NextResponse.json({ error: "Payment entry not found" }, { status: 404 });
    }

    const [rows] = await conn.execute(
      `SELECT * FROM manual_payment_received
       WHERE payment_id = ?
       ORDER BY payment_date DESC, created_at DESC`,
      [id],
    );

    const totalReceived = await getTotalReceived(conn, id);

    return NextResponse.json({
      success: true,
      data: rows,
      total_received: totalReceived,
      pending_amount: Number(payment.amount || 0),
      status: payment.status,
    });
  } catch (error) {
    console.error("❌ Error fetching received payments:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await verifyManualPaymentsApiAccess(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!ACCOUNTS_ROLES.has(String(auth.role || "").toUpperCase())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const formData = await request.formData();

    const paymentDate = formData.get("payment_date");
    const referenceNumber = formData.get("reference_number");
    const amount = formData.get("amount");
    const attachment = formData.get("attachment");

    if (!paymentDate || !amount) {
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

    const payment = await getPaymentRow(conn, id);
    if (!payment) {
      return NextResponse.json({ error: "Payment entry not found" }, { status: 404 });
    }

    let attachmentPath = null;
    if (attachment && typeof attachment === "object" && attachment.size > 0) {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const timestamp = Date.now();
      const fileExt = path.extname(attachment.name).slice(0, 16);
      const fileName = `received_${id}_${timestamp}${fileExt}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      const buffer = Buffer.from(await attachment.arrayBuffer());
      await writeFile(filePath, buffer);
      attachmentPath = `/payment_received/${fileName}`;
    }

    await conn.execute(
      `INSERT INTO manual_payment_received (
        payment_id, payment_date, reference_number, amount, attachment_file, received_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        paymentDate,
        referenceNumber || null,
        parsedAmount,
        attachmentPath,
        auth.username,
      ],
    );

    const totalReceived = await getTotalReceived(conn, id);
    const pendingAmount = Number(payment.amount || 0);

    if (totalReceived >= pendingAmount && pendingAmount > 0) {
      await conn.execute(
        `UPDATE manual_payment_pending
         SET status = 'received', modified_by = ?, modified_at = NOW()
         WHERE id = ?`,
        [auth.username, id],
      );
    }

    return NextResponse.json({
      success: true,
      message: "Received payment recorded successfully",
      total_received: totalReceived,
      status: totalReceived >= pendingAmount && pendingAmount > 0 ? "received" : payment.status,
    });
  } catch (error) {
    console.error("❌ Error recording received payment:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 },
    );
  }
}
