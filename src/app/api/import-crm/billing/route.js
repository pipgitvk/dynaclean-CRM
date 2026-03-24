import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";
import path from "path";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

/** GET /api/import-crm/billing — admin: list all billing records */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!isImportCrmAdmin(payload.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    await ensureImportCrmTables();
    const db = await getDbConnection();
    const [rows] = await db.query(
      `SELECT
         b.id,
         b.link_quote_id,
         b.shipment_id,
         b.agent_email,
         b.billing_portal_token,
         b.bill_no,
         b.bill_date,
         b.bill_amount,
         b.bill_file,
         b.remarks,
         b.with_invoice,
         b.submitted_at,
         b.status,
         b.admin_remarks,
         b.approved_amount,
         b.actioned_by,
         b.actioned_at,
         b.payment_date,
         b.payment_mode,
         b.payment_transaction_no,
         b.amount_paid,
         b.payment_proof_file,
         b.payment_sent_at,
         b.payment_sent_by,
         b.created_at,
         s.ship_from,
         s.ship_to
       FROM import_crm_billing b
       INNER JOIN import_crm_shipments s ON s.id = b.shipment_id
       ORDER BY
         (b.submitted_at IS NULL) ASC,
         b.submitted_at DESC,
         b.created_at DESC
       LIMIT 2000`,
    );

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("import-crm billing GET:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

/** GET /api/import-crm/billing-file/[id]/[filename] — serve uploaded bill file */
export async function fileViewHandler(request, { billingId, fileName }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!isImportCrmAdmin(payload.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const safeName = path.basename(fileName || "");
    if (!safeName) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const { readFile } = await import("fs/promises");
    const filePath = path.join(process.cwd(), "uploads", "import-crm-billing", String(billingId), safeName);
    const buf = await readFile(filePath);
    const ext = safeName.split(".").pop()?.toLowerCase() || "";
    const mime =
      ext === "pdf" ? "application/pdf"
      : ["jpg", "jpeg"].includes(ext) ? "image/jpeg"
      : ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : "application/octet-stream";

    return new Response(buf, {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }
}
