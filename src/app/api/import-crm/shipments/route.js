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

function parseIdArrayJson(raw) {
  if (raw == null || raw === "") return [];
  if (typeof raw !== "string") return [];
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    const out = [];
    const seen = new Set();
    for (const x of p) {
      const n = parseInt(String(x).trim(), 10);
      if (!Number.isFinite(n) || n < 1) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

function agentLabelFromRow(a) {
  const c = a.company_name && String(a.company_name).trim();
  return c || a.agent_name || `Agent #${a.id}`;
}

function supplierLabelFromRow(s) {
  const n = s.supplier_name && String(s.supplier_name).trim();
  return n || (s.factory_name && String(s.factory_name).trim()) || `Supplier #${s.id}`;
}

function sqlPlaceholders(n) {
  return Array.from({ length: n }, () => "?").join(", ");
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
              s.public_link_token, s.crm_agent_id, s.supplier_id,
              s.shipment_crm_agent_ids_json, s.shipment_supplier_ids_json,
              s.created_by, s.created_at, s.updated_at
       FROM import_crm_shipments s
       ORDER BY s.id DESC`,
    );

    const [agentRows] = await db.query(
      `SELECT id, agent_name, company_name FROM import_crm_agents`,
    );
    const idToAgentLabel = new Map();
    for (const a of agentRows || []) {
      idToAgentLabel.set(a.id, agentLabelFromRow(a));
    }

    const [supplierRows] = await db.query(
      `SELECT id, supplier_name, factory_name FROM import_crm_suppliers`,
    );
    const idToSupplierLabel = new Map();
    for (const sup of supplierRows || []) {
      idToSupplierLabel.set(sup.id, supplierLabelFromRow(sup));
    }

    for (const row of rows || []) {
      let agentIds = parseIdArrayJson(row.shipment_crm_agent_ids_json);
      if (agentIds.length === 0 && row.crm_agent_id != null) {
        agentIds = [row.crm_agent_id];
      }
      row.crm_agent_ids = agentIds;
      const agentLabels = agentIds.map(
        (id) => idToAgentLabel.get(id) || `Agent #${id}`,
      );
      row.agents_display = agentLabels.length ? agentLabels.join(", ") : "—";
      row.agent_display_name =
        agentIds.length > 0
          ? idToAgentLabel.get(agentIds[0]) || `Agent #${agentIds[0]}`
          : null;

      let supplierIds = parseIdArrayJson(row.shipment_supplier_ids_json);
      if (supplierIds.length === 0 && row.supplier_id != null) {
        supplierIds = [row.supplier_id];
      }
      row.supplier_ids = supplierIds;
      const supplierLabels = supplierIds.map(
        (id) => idToSupplierLabel.get(id) || `Supplier #${id}`,
      );
      row.suppliers_display = supplierLabels.length
        ? supplierLabels.join(", ")
        : "—";

      delete row.shipment_crm_agent_ids_json;
      delete row.shipment_supplier_ids_json;
    }

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

    let agentIds = [];
    if (Array.isArray(body?.crm_agent_ids)) {
      const seen = new Set();
      for (const x of body.crm_agent_ids) {
        const n = parseInt(String(x).trim(), 10);
        if (!Number.isFinite(n) || n < 1) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        agentIds.push(n);
      }
    } else {
      const rawAgentId = body?.crm_agent_id;
      if (rawAgentId != null && String(rawAgentId).trim() !== "") {
        const aid = Number.parseInt(String(rawAgentId).trim(), 10);
        if (!Number.isFinite(aid) || aid < 1) {
          return NextResponse.json(
            { message: "Invalid agent selection" },
            { status: 400 },
          );
        }
        agentIds = [aid];
      }
    }

    if (agentIds.length > 0) {
      const ph = sqlPlaceholders(agentIds.length);
      const [agentRows] = await db.query(
        `SELECT id FROM import_crm_agents WHERE id IN (${ph})`,
        agentIds,
      );
      if (!agentRows?.length || agentRows.length !== agentIds.length) {
        return NextResponse.json(
          { message: "One or more selected agents were not found" },
          { status: 400 },
        );
      }
    }

    let supplierIds = [];
    if (Array.isArray(body?.supplier_ids)) {
      const seen = new Set();
      for (const x of body.supplier_ids) {
        const n = parseInt(String(x).trim(), 10);
        if (!Number.isFinite(n) || n < 1) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        supplierIds.push(n);
      }
    } else {
      const rawSid = body?.supplier_id;
      if (rawSid != null && String(rawSid).trim() !== "") {
        const sid = Number.parseInt(String(rawSid).trim(), 10);
        if (!Number.isFinite(sid) || sid < 1) {
          return NextResponse.json(
            { message: "Invalid supplier selection" },
            { status: 400 },
          );
        }
        supplierIds = [sid];
      }
    }

    if (supplierIds.length > 0) {
      const phS = sqlPlaceholders(supplierIds.length);
      const [supRows] = await db.query(
        `SELECT id FROM import_crm_suppliers WHERE id IN (${phS})`,
        supplierIds,
      );
      if (!supRows?.length || supRows.length !== supplierIds.length) {
        return NextResponse.json(
          { message: "One or more selected suppliers were not found" },
          { status: 400 },
        );
      }
    }

    const crm_agent_id = agentIds.length > 0 ? agentIds[0] : null;
    const shipment_crm_agent_ids_json =
      agentIds.length > 0 ? JSON.stringify(agentIds) : null;
    const supplier_id = supplierIds.length > 0 ? supplierIds[0] : null;
    const shipment_supplier_ids_json =
      supplierIds.length > 0 ? JSON.stringify(supplierIds) : null;

    let publicToken = generateImportCrmQuoteToken();
    let insertId = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const [result] = await db.query(
          `INSERT INTO import_crm_shipments
            (ship_from, ship_to, cbm, shipment_term, mode,
             material_ready_date, agent_delivery_deadline, remarks, created_by,
             public_link_token, crm_agent_id, supplier_id,
             shipment_crm_agent_ids_json, shipment_supplier_ids_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            supplier_id,
            shipment_crm_agent_ids_json,
            shipment_supplier_ids_json,
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
