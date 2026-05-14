import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";
import {
  getImportCrmPublicBaseUrl,
  sendImportCrmPaymentEmail,
} from "@/lib/importCrmEmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

function extOf(filename) {
  const s = String(filename || "");
  const i = s.lastIndexOf(".");
  return i < 0 ? "" : s.slice(i + 1).toLowerCase();
}
function safeBaseName(name) {
  return path.basename(String(name || "file"))
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180) || "file";
}
async function saveProof(billingId, file) {
  if (!file || typeof file.arrayBuffer !== "function") return null;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return null;
  if (buf.length > MAX_FILE_BYTES) throw new Error("File too large (max 15 MB)");
  const orig = safeBaseName(file.name);
  const ext = extOf(orig);
  if (!ALLOWED_EXT.has(ext)) throw new Error(`File type not allowed (.${ext})`);
  const stored = `${randomUUID()}_${orig}`;
  const dir = path.join(process.cwd(), "uploads", "import-crm-billing-payment", String(billingId));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), buf);
  return path.posix.join("import-crm-billing-payment", String(billingId), stored);
}

/** POST /api/import-crm/billing/[id]/payment */
export async function POST(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (payload.role !== "SUPERADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { id: raw } = await params;
    const id = Number.parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();

    const [found] = await db.query(
      `SELECT b.id, b.status, b.agent_email, b.shipment_id
       FROM import_crm_billing b WHERE b.id = ? LIMIT 1`,
      [id],
    );
    const row = found?.[0];
    if (!row) return NextResponse.json({ message: "Billing record not found" }, { status: 404 });
    if (row.status !== "APPROVED") {
      return NextResponse.json(
        { message: "Cannot record payment: billing is not approved yet." },
        { status: 409 },
      );
    }

    const formData = await request.formData();
    const payment_date = String(formData.get("payment_date") ?? "").trim() || null;
    const payment_mode = String(formData.get("payment_mode") ?? "").trim() || null;
    const payment_transaction_no = String(formData.get("payment_transaction_no") ?? "").trim() || null;
    const amount_paid_raw = String(formData.get("amount_paid") ?? "").trim();
    const amount_paid = amount_paid_raw !== "" && Number.isFinite(Number(amount_paid_raw))
      ? Number(amount_paid_raw) : null;
    const admin_remarks = String(formData.get("admin_remarks") ?? "").trim() || null;

    let payment_proof_file = null;
    const fileEntry = formData.get("payment_proof");
    if (fileEntry && typeof fileEntry === "object" && fileEntry.size > 0) {
      try {
        payment_proof_file = await saveProof(id, fileEntry);
      } catch (fileErr) {
        return NextResponse.json({ message: String(fileErr?.message || fileErr) }, { status: 400 });
      }
    }

    await db.query(
      `UPDATE import_crm_billing
       SET payment_date = ?, payment_mode = ?, payment_transaction_no = ?,
           amount_paid = ?, payment_proof_file = ?,
           payment_sent_at = CURRENT_TIMESTAMP, payment_sent_by = ?,
           admin_remarks = COALESCE(?, admin_remarks)
       WHERE id = ?`,
      [payment_date, payment_mode, payment_transaction_no,
       amount_paid, payment_proof_file,
       payload.username || null, admin_remarks, id],
    );

    // Advance shipment status → COMPLETED
    if (row.shipment_id) {
      await db.query(
        `UPDATE import_crm_shipments SET status = 'COMPLETED' WHERE id = ?`,
        [row.shipment_id],
      );
    }

    // Build public URL for proof file (admin-authenticated link)
    let proofUrl = null;
    if (payment_proof_file) {
      const baseUrl = getImportCrmPublicBaseUrl();
      const parts = String(payment_proof_file).replace(/\\/g, "/").split("/");
      // parts: ["import-crm-billing-payment", billingId, filename]
      if (parts.length >= 3) {
        const fname = parts[parts.length - 1];
        proofUrl = `${baseUrl}/api/import-crm/billing-payment-file/${id}/${encodeURIComponent(fname)}`;
      }
    }

    const isRealEmail = (s) => {
      const t = String(s ?? "").trim().toLowerCase();
      return t && !t.includes("@shipment-quote.local") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
    };

    let emailSent = false;
    let emailError = null;

    if (isRealEmail(row.agent_email)) {
      try {
        await sendImportCrmPaymentEmail({
          to: String(row.agent_email).trim().toLowerCase(),
          shipmentRef: row.shipment_id ? String(row.shipment_id) : null,
          paymentDate: payment_date,
          paymentMode: payment_mode,
          transactionNo: payment_transaction_no,
          amountPaid: amount_paid,
          proofUrl,
          adminRemarks: admin_remarks,
        });
        emailSent = true;
      } catch (err) {
        emailError = String(err?.message || err);
        console.error("payment email:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      emailSent,
      emailError: emailError || undefined,
      payment_proof_file,
      message: emailSent
        ? "Payment recorded and email sent to agent."
        : "Payment recorded — email not sent (check SMTP or agent email).",
    });
  } catch (error) {
    console.error("billing payment POST:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
