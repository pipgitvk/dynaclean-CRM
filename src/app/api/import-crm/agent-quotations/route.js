import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

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
         q.crm_agent_id,
         q.shipment_id,
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
         q.created_at,
         COALESCE(NULLIF(TRIM(a.company_name), ''), a.agent_name) AS agent_name
       FROM import_crm_agent_quotations q
       INNER JOIN import_crm_agents a ON a.id = q.crm_agent_id
       ORDER BY q.created_at DESC, q.id DESC
       LIMIT 2000`,
    );

    return NextResponse.json({ quotations: rows });
  } catch (error) {
    console.error("import-crm agent-quotations GET:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
