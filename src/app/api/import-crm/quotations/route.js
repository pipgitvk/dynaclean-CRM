import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

/** Quote submissions: public shipment link quotes only (not supplier import-quote links). */
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
         q.id,
         CAST(q.shipment_id AS CHAR) AS shipment_id,
         q.submitter_email,
         q.public_link_token_at_submit,
         q.agent_id,
         q.ocean_freight,
         q.origin_cfs,
         q.origin_customs,
         q.origin_docs,
         q.origin_vgm,
         q.destination_cc_fee,
         q.destination_thc,
         q.destination_do_fee,
         q.destination_deconsole_fee,
         q.destination_gst,
         q.clearance_agency,
         q.clearance_loading,
         q.clearance_edi,
         q.clearance_exam,
         q.clearance_cfs_actual,
         q.clearance_transport_actual,
         q.clearance_misc,
         q.exchange_rate,
         q.total_cost_inr,
         q.remarks,
         q.awarded_at,
         q.award_form_submitted_at,
         q.af_pickup_person_details,
         q.af_supplier_address,
         q.af_cargo_ready_confirmation,
         q.af_booking_details,
         q.af_vessel_flight_details,
         q.af_container_details,
         q.af_bl_file,
         q.af_invoice_file,
         q.af_packing_list_file,
         q.af_other_documents_json,
         q.created_at
       FROM import_crm_shipment_link_quotes q
       ORDER BY q.created_at DESC, q.id DESC
       LIMIT 2000`,
    );

    return NextResponse.json({ quotations: rows });
  } catch (error) {
    console.error("import-crm quotations GET:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
