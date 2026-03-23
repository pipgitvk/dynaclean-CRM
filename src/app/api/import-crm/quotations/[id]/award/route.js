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

/**
 * Award this public-link quote for its shipment (clears any other award on the same shipment).
 * Issues a new portal token and emails the submitter the follow-up form link.
 * Body `{ "clear": true }` clears the award for that shipment (no row stays awarded).
 */
export async function POST(request, { params }) {
  let connection;
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

    let clear = false;
    try {
      const body = await request.json();
      clear = Boolean(body?.clear);
    } catch {
      /* no body */
    }

    await ensureImportCrmTables();
    const pool = await getDbConnection();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [found] = await connection.execute(
      `SELECT id, shipment_id, submitter_email, awarded_at, award_form_submitted_at
       FROM import_crm_shipment_link_quotes WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = found?.[0];
    if (!row) {
      await connection.rollback();
      return NextResponse.json({ message: "Quote not found" }, { status: 404 });
    }
    const shipmentId = row.shipment_id;
    const submitterEmail = row.submitter_email;

    if (clear) {
      if (!row.awarded_at) {
        await connection.rollback();
        return NextResponse.json(
          { message: "This quote is not awarded." },
          { status: 400 },
        );
      }
      if (row.award_form_submitted_at) {
        await connection.rollback();
        return NextResponse.json(
          {
            message:
              "Cannot revoke: follow-up form is already submitted for this award.",
            code: "AWARD_REVOKE_BLOCKED",
          },
          { status: 409 },
        );
      }
      await connection.execute(
        `UPDATE import_crm_shipment_link_quotes
         SET awarded_at = NULL, award_portal_token = NULL
         WHERE shipment_id = ?`,
        [shipmentId],
      );
      await connection.execute(
        `UPDATE import_crm_shipments SET status = 'PENDING' WHERE id = ?`,
        [shipmentId],
      );
      await connection.commit();
      return NextResponse.json({
        ok: true,
        awarded: false,
        message: "Award cleared",
      });
    }

    const portalToken = generateImportCrmQuoteToken();

    await connection.execute(
      `UPDATE import_crm_shipment_link_quotes
       SET awarded_at = NULL, award_portal_token = NULL
       WHERE shipment_id = ?`,
      [shipmentId],
    );

    await connection.execute(
      `UPDATE import_crm_shipment_link_quotes SET
        awarded_at = CURRENT_TIMESTAMP,
        award_portal_token = ?,
        award_form_submitted_at = NULL,
        af_pickup_person_details = NULL,
        af_supplier_address = NULL,
        af_cargo_ready_confirmation = NULL,
        af_booking_details = NULL,
        af_vessel_flight_details = NULL,
        af_container_details = NULL,
        af_bl_file = NULL,
        af_invoice_file = NULL,
        af_packing_list_file = NULL,
        af_other_documents_json = NULL
       WHERE id = ?`,
      [portalToken, id],
    );

    await connection.execute(
      `UPDATE import_crm_shipments SET status = 'AWARDED' WHERE id = ?`,
      [shipmentId],
    );

    await connection.commit();

    const baseUrl = getImportCrmPublicBaseUrl();
    const portalUrl = `${baseUrl}/import-award/${portalToken}`;

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
        console.error("import-crm award portal email:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      awarded: true,
      message: emailSent
        ? "Quote awarded — email sent with form link"
        : emailSkipped
          ? "Quote awarded — no valid submitter email (link not emailed)"
          : "Quote awarded — email failed; re-check SMTP and award again to resend",
      emailSent,
      emailSkipped,
      emailError: emailError || undefined,
      portalUrl: emailSent ? undefined : portalUrl,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        /* ignore */
      }
    }
    console.error("import-crm quotations award POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  } finally {
    if (connection) connection.release();
  }
}
