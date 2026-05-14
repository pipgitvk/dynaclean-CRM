import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

/** Awarded public-link quotes + agent follow-up form (post-award portal). */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!isImportCrmAdmin(payload.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();
    const [rows] = await db.query(
      `SELECT
         q.id AS link_quote_id,
         CAST(q.shipment_id AS CHAR) AS shipment_id,
         q.submitter_email,
         q.agent_id,
         q.total_cost_inr,
         q.awarded_at,
         q.award_form_submitted_at,
         q.af_approved_at,
         q.af_approved_by,
         q.af_pickup_person_details,
         q.af_pickup_person_name,
         q.af_pickup_person_phone,
         q.af_pickup_person_email,
         q.af_pickup_date,
         q.af_picked_date,
         q.af_transit_date,
         q.af_delivered_date,
         q.af_supplier_name,
         q.af_supplier_email,
         q.af_supplier_phone,
         q.af_supplier_address,
         q.af_cargo_ready_confirmation,
         q.af_booking_details,
         q.af_vessel_flight_details,
         q.af_container_details,
         q.af_bl_file,
         q.af_invoice_file,
         q.af_packing_list_file,
         q.af_other_documents_json,
         s.ship_from,
         s.ship_to,
         s.mode,
         s.shipment_term
       FROM import_crm_shipment_link_quotes q
       INNER JOIN import_crm_shipments s ON s.id = q.shipment_id
       WHERE q.awarded_at IS NOT NULL
       ORDER BY
         (q.award_form_submitted_at IS NULL) ASC,
         (q.af_approved_at IS NOT NULL) ASC,
         q.award_form_submitted_at DESC,
         q.awarded_at DESC,
         q.id DESC
       LIMIT 1000`,
    );

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("import-crm award-followups GET:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
