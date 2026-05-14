import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
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
      `SELECT id, agent_name, company_name, country, state, city,
              contact_person, email, phone, address,
              service_type, mode_supported, shipment_type_supported,
              origin_coverage, destination_coverage,
              gst_no, pan_no, status, remarks,
              created_at, updated_at
       FROM import_crm_agents
       ORDER BY COALESCE(NULLIF(TRIM(company_name), ''), agent_name) ASC`,
    );
    return NextResponse.json({ agents: rows });
  } catch (error) {
    console.error("import-crm agents GET:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!isImportCrmAdmin(payload.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const companyName = strOrNull(body?.company_name);
    const legacyName = strOrNull(body?.agent_name);
    const effectiveName = companyName || legacyName;
    if (!effectiveName) {
      return NextResponse.json(
        { message: "company_name is required" },
        { status: 400 },
      );
    }

    const agent_name = effectiveName;
    const company_name = companyName || effectiveName;

    const country = strOrNull(body?.country);
    const state = strOrNull(body?.state);
    const city = strOrNull(body?.city);
    const contact_person = strOrNull(body?.contact_person);
    const email = strOrNull(body?.email);
    const phone = strOrNull(body?.phone);
    const address = strOrNull(body?.address);
    const service_type = strOrNull(body?.service_type);
    const mode_supported = strOrNull(body?.mode_supported);
    const shipment_type_supported = strOrNull(body?.shipment_type_supported);
    const origin_coverage = strOrNull(body?.origin_coverage);
    const destination_coverage = strOrNull(body?.destination_coverage);
    const gst_no = strOrNull(body?.gst_no);
    const pan_no = strOrNull(body?.pan_no);
    const status = strOrNull(body?.status) || "Active";
    const remarks = strOrNull(body?.remarks);

    await ensureImportCrmTables();
    const db = await getDbConnection();

    const [result] = await db.query(
      `INSERT INTO import_crm_agents
        (agent_name, company_name, country, state, city,
         contact_person, email, phone, address,
         service_type, mode_supported, shipment_type_supported,
         origin_coverage, destination_coverage,
         gst_no, pan_no, status, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent_name,
        company_name,
        country,
        state,
        city,
        contact_person,
        email,
        phone,
        address,
        service_type,
        mode_supported,
        shipment_type_supported,
        origin_coverage,
        destination_coverage,
        gst_no,
        pan_no,
        status,
        remarks,
      ],
    );

    return NextResponse.json(
      {
        id: result.insertId,
        message: "Agent created",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("import-crm agents POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
