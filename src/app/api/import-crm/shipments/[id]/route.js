import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

export async function PATCH(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!isImportCrmAdmin(payload.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { id: raw } = await params;
    const id = Number.parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      ship_from, ship_to, cbm, shipment_term, mode,
      material_ready_date, agent_delivery_deadline, remarks,
      crm_agent_ids, supplier_ids,
    } = body;

    if (!ship_from || !ship_to) {
      return NextResponse.json({ message: "Ship from and Ship to are required" }, { status: 400 });
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();

    const agentIdsJson = JSON.stringify(
      Array.isArray(crm_agent_ids) ? crm_agent_ids.map(Number).filter(Boolean) : [],
    );
    const supplierIdsJson = JSON.stringify(
      Array.isArray(supplier_ids) ? supplier_ids.map(Number).filter(Boolean) : [],
    );

    const [result] = await db.query(
      `UPDATE import_crm_shipments
       SET ship_from = ?, ship_to = ?, cbm = ?,
           shipment_term = ?, mode = ?,
           material_ready_date = ?, agent_delivery_deadline = ?,
           remarks = ?,
           shipment_crm_agent_ids_json = ?,
           shipment_supplier_ids_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        String(ship_from).trim(),
        String(ship_to).trim(),
        cbm != null && cbm !== "" ? Number(cbm) : null,
        shipment_term || "FOB",
        mode || "Sea",
        material_ready_date || null,
        agent_delivery_deadline || null,
        remarks || null,
        agentIdsJson,
        supplierIdsJson,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Shipment not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Shipment updated" });
  } catch (error) {
    console.error("import-crm shipments PATCH:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
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

    await ensureImportCrmTables();
    const db = await getDbConnection();
    const [result] = await db.query(
      `DELETE FROM import_crm_shipments WHERE id = ?`,
      [id],
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: "Deleted" });
  } catch (error) {
    console.error("import-crm shipments DELETE:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
