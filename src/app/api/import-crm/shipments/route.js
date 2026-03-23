import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";
import { generateImportCrmQuoteToken } from "@/lib/generateImportCrmQuoteToken";

const TERMS = new Set(["FOB", "FCA", "CIF"]);
const MODES = new Set(["Sea", "Air"]);

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function dateOrNull(v) {
  const s = strOrNull(v);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "INVALID";
  return s;
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
      `SELECT s.id, s.ship_from, s.ship_to, s.cbm, s.shipment_term, s.mode,
              s.material_ready_date, s.agent_delivery_deadline, s.remarks,
              s.public_link_token, s.crm_agent_id, s.created_by, s.created_at, s.updated_at,
              COALESCE(NULLIF(TRIM(a.company_name), ''), a.agent_name) AS agent_display_name
       FROM import_crm_shipments s
       LEFT JOIN import_crm_agents a ON a.id = s.crm_agent_id
       ORDER BY s.id DESC`,
    );
    return NextResponse.json({ shipments: rows });
  } catch (error) {
    console.error("import-crm shipments GET:", error);
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
    const ship_from = strOrNull(body?.ship_from);
    const ship_to = strOrNull(body?.ship_to);
    const shipment_term = strOrNull(body?.shipment_term)?.toUpperCase();
    const mode = strOrNull(body?.mode);
    const modeNorm =
      mode === "Sea" || mode === "Air"
        ? mode
        : mode?.toLowerCase() === "sea"
          ? "Sea"
          : mode?.toLowerCase() === "air"
            ? "Air"
            : null;

    const cbmRaw = body?.cbm;
    const cbm =
      cbmRaw === "" || cbmRaw == null ? NaN : Number(cbmRaw);

    const material_ready_date = dateOrNull(body?.material_ready_date);
    const agent_delivery_deadline = dateOrNull(body?.agent_delivery_deadline);
    const remarks = strOrNull(body?.remarks);

    if (!ship_from || !ship_to) {
      return NextResponse.json(
        { message: "From and To are required" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(cbm) || cbm < 0) {
      return NextResponse.json(
        { message: "CBM must be a valid non-negative number" },
        { status: 400 },
      );
    }
    if (!shipment_term || !TERMS.has(shipment_term)) {
      return NextResponse.json(
        { message: "Shipment term must be FOB, FCA, or CIF" },
        { status: 400 },
      );
    }
    if (!modeNorm || !MODES.has(modeNorm)) {
      return NextResponse.json(
        { message: "Mode must be Sea or Air" },
        { status: 400 },
      );
    }
    if (material_ready_date === "INVALID" || agent_delivery_deadline === "INVALID") {
      return NextResponse.json(
        { message: "Invalid date format (use YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();

    let crm_agent_id = null;
    const rawAgentId = body?.crm_agent_id;
    if (rawAgentId != null && String(rawAgentId).trim() !== "") {
      const aid = Number.parseInt(String(rawAgentId).trim(), 10);
      if (!Number.isFinite(aid) || aid < 1) {
        return NextResponse.json(
          { message: "Invalid agent selection" },
          { status: 400 },
        );
      }
      const [agentRows] = await db.query(
        `SELECT id FROM import_crm_agents WHERE id = ? LIMIT 1`,
        [aid],
      );
      if (!agentRows?.length) {
        return NextResponse.json(
          { message: "Selected agent was not found" },
          { status: 400 },
        );
      }
      crm_agent_id = aid;
    }

    let publicToken = generateImportCrmQuoteToken();
    let insertId = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const [result] = await db.query(
          `INSERT INTO import_crm_shipments
            (ship_from, ship_to, cbm, shipment_term, mode,
             material_ready_date, agent_delivery_deadline, remarks, created_by,
             public_link_token, crm_agent_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ship_from,
            ship_to,
            cbm,
            shipment_term,
            modeNorm,
            material_ready_date,
            agent_delivery_deadline,
            remarks,
            payload.username || null,
            publicToken,
            crm_agent_id,
          ],
        );
        insertId = result.insertId;
        break;
      } catch (err) {
        if (err?.code === "ER_DUP_ENTRY" && attempt < 5) {
          publicToken = generateImportCrmQuoteToken();
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json(
      {
        id: insertId,
        public_link_token: publicToken,
        message: "Shipment saved",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("import-crm shipments POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
