import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";
import { generateImportCrmQuoteToken } from "@/lib/generateImportCrmQuoteToken";
import {
  getImportCrmPublicBaseUrl,
  sendImportCrmAwardPortalEmail,
} from "@/lib/importCrmEmail";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

function isRealEmail(s) {
  const t = String(s ?? "").trim().toLowerCase();
  if (!t || t.includes("@shipment-quote.local")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** All clearable field keys (maps to DB column name with af_ prefix). */
const VALID_FIELDS = new Set([
  "pickup_person_details",
  "supplier_address",
  "cargo_ready_confirmation",
  "booking_details",
  "vessel_flight_details",
  "container_details",
  "bl_file",
  "invoice_file",
  "packing_list_file",
  "other_documents",
]);

/**
 * Re-assign a partial set of fields: clear them, store which ones need re-fill,
 * generate a new portal token and email the submitter.
 * Body: { fields: string[] }  — subset of VALID_FIELDS keys.
 */
export async function POST(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!isImportCrmAdmin(payload.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id: raw } = await params;
    const id = Number.parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const rawFields = Array.isArray(body?.fields) ? body.fields : [];
    const fields = [...new Set(rawFields.filter((f) => VALID_FIELDS.has(f)))];
    if (fields.length === 0) {
      return NextResponse.json(
        { message: "Select at least one field to re-assign." },
        { status: 400 },
      );
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();

    const [found] = await db.query(
      `SELECT id, shipment_id, submitter_email, awarded_at, af_approved_at
       FROM import_crm_shipment_link_quotes WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = found?.[0];
    if (!row) {
      return NextResponse.json(
        { message: "Follow-up not found" },
        { status: 404 },
      );
    }
    if (!row.awarded_at) {
      return NextResponse.json(
        { message: "This quote has not been awarded yet." },
        { status: 409 },
      );
    }
    if (row.af_approved_at) {
      return NextResponse.json(
        { message: "Cannot re-assign after the follow-up has been approved." },
        { status: 409 },
      );
    }

    // Build SET clause — clear only the selected fields
    const clearParts = [];
    const clearVals = [];
    for (const f of fields) {
      if (f === "other_documents") {
        clearParts.push("af_other_documents_json = NULL");
      } else {
        clearParts.push(`af_${f} = NULL`);
      }
    }

    const portalToken = generateImportCrmQuoteToken();

    clearParts.push(
      "award_portal_token = ?",
      "award_form_submitted_at = NULL",
      "af_reassign_fields_json = ?",
      "af_approved_at = NULL",
      "af_approved_by = NULL",
    );
    clearVals.push(portalToken, JSON.stringify(fields), id);

    await db.query(
      `UPDATE import_crm_shipment_link_quotes
       SET ${clearParts.join(", ")}
       WHERE id = ?`,
      clearVals,
    );

    const baseUrl = getImportCrmPublicBaseUrl();
    const portalUrl = `${baseUrl}/import-award/${portalToken}`;
    const submitterEmail = row.submitter_email;

    let emailSent = false;
    let emailSkipped = false;
    let emailError = null;
    if (!isRealEmail(submitterEmail)) {
      emailSkipped = true;
    } else {
      try {
        await sendImportCrmAwardPortalEmail({
          to: String(submitterEmail).trim().toLowerCase(),
          portalUrl,
        });
        emailSent = true;
      } catch (err) {
        emailError = String(err?.message || err);
        console.error("import-crm reassign portal email:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      message: emailSent
        ? `Re-assigned ${fields.length} field(s) — new form link emailed`
        : emailSkipped
          ? `Re-assigned ${fields.length} field(s) — no valid email (link not sent)`
          : `Re-assigned ${fields.length} field(s) — email failed; check SMTP`,
      fields,
      emailSent,
      emailSkipped,
      emailError: emailError || undefined,
      portalUrl: emailSent ? undefined : portalUrl,
    });
  } catch (error) {
    console.error("import-crm award-followups reassign POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
