import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getDbConnection } from "@/lib/db";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN_RE = /^[a-f0-9]{32,64}$/i;
const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx"]);

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

async function saveFile(billingId, file) {
  if (!file || typeof file.arrayBuffer !== "function") return null;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return null;
  if (buf.length > MAX_FILE_BYTES) throw new Error("File too large (max 15 MB)");
  const orig = safeBaseName(file.name);
  const ext = extOf(orig);
  if (!ALLOWED_EXT.has(ext)) throw new Error(`File type not allowed (${ext})`);
  const stored = `${randomUUID()}_${orig}`;
  const dir = path.join(process.cwd(), "uploads", "import-crm-billing", String(billingId));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), buf);
  return path.posix.join("import-crm-billing", String(billingId), stored);
}

/** GET — load billing form metadata */
export async function GET(_request, { params }) {
  try {
    const { token: raw } = await params;
    const token = String(raw ?? "").trim();
    if (!TOKEN_RE.test(token)) {
      return NextResponse.json({ message: "Invalid link" }, { status: 404, headers: NO_STORE });
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();
    const [rows] = await db.query(
      `SELECT b.id, b.link_quote_id, b.shipment_id, b.submitted_at,
              b.bill_no, b.bill_date, b.bill_amount, b.bill_file,
              b.remarks, b.with_invoice,
              s.ship_from, s.ship_to
       FROM import_crm_billing b
       INNER JOIN import_crm_shipments s ON s.id = b.shipment_id
       WHERE b.billing_portal_token = ?
       LIMIT 1`,
      [token],
    );
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ message: "This link is not valid." }, { status: 404, headers: NO_STORE });
    }

    return NextResponse.json({
      ok: true,
      submitted: Boolean(row.submitted_at),
      shipment: { id: String(row.shipment_id), ship_from: row.ship_from, ship_to: row.ship_to },
      form: {
        bill_no: row.bill_no,
        bill_date: row.bill_date,
        bill_amount: row.bill_amount,
        bill_file: row.bill_file,
        remarks: row.remarks,
        with_invoice: Boolean(row.with_invoice),
      },
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("public-billing GET:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500, headers: NO_STORE });
  }
}

/** POST — submit billing form */
export async function POST(request, { params }) {
  let connection;
  try {
    const { token: raw } = await params;
    const token = String(raw ?? "").trim();
    if (!TOKEN_RE.test(token)) {
      return NextResponse.json({ message: "Invalid link" }, { status: 404, headers: NO_STORE });
    }

    await ensureImportCrmTables();
    const pool = await getDbConnection();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, submitted_at, shipment_id FROM import_crm_billing
       WHERE billing_portal_token = ? LIMIT 1`,
      [token],
    );
    const row = rows?.[0];
    if (!row) {
      await connection.rollback();
      return NextResponse.json({ message: "This link is not valid." }, { status: 404, headers: NO_STORE });
    }
    if (row.submitted_at) {
      await connection.rollback();
      return NextResponse.json(
        { message: "This billing form has already been submitted.", code: "ALREADY_SUBMITTED" },
        { status: 409, headers: NO_STORE },
      );
    }

    const billingId = row.id;
    const formData = await request.formData();

    const bill_no = String(formData.get("bill_no") ?? "").trim() || null;
    const bill_date = String(formData.get("bill_date") ?? "").trim() || null;
    const bill_amount_raw = String(formData.get("bill_amount") ?? "").trim();
    const bill_amount = bill_amount_raw !== "" && Number.isFinite(Number(bill_amount_raw))
      ? Number(bill_amount_raw) : null;
    const remarks = String(formData.get("remarks") ?? "").trim() || null;
    const with_invoice = formData.get("with_invoice") === "1" ? 1 : 0;

    if (!bill_no) {
      await connection.rollback();
      return NextResponse.json({ message: "Bill number is required." }, { status: 400, headers: NO_STORE });
    }

    let bill_file = null;
    const fileEntry = formData.get("bill_file");
    if (fileEntry && typeof fileEntry === "object" && fileEntry.size > 0) {
      try {
        bill_file = await saveFile(billingId, fileEntry);
      } catch (fileErr) {
        await connection.rollback();
        return NextResponse.json({ message: String(fileErr?.message || fileErr) }, { status: 400, headers: NO_STORE });
      }
    }

    await connection.execute(
      `UPDATE import_crm_billing
       SET bill_no = ?, bill_date = ?, bill_amount = ?,
           bill_file = ?, remarks = ?, with_invoice = ?,
           submitted_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [bill_no, bill_date, bill_amount, bill_file, remarks, with_invoice, billingId],
    );

    // Advance shipment status → BILL_APPROVAL_PENDING
    if (row.shipment_id) {
      await connection.execute(
        `UPDATE import_crm_shipments SET status = 'BILL_APPROVAL_PENDING' WHERE id = ?`,
        [row.shipment_id],
      );
    }

    await connection.commit();
    return NextResponse.json(
      { ok: true, message: "Billing details submitted successfully." },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch { /* ignore */ } }
    console.error("public-billing POST:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500, headers: NO_STORE });
  } finally {
    if (connection) connection.release();
  }
}
