import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[a-f0-9]{32,64}$/i;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function decOrNull(v) {
  if (v === "" || v == null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return "INVALID";
  return n;
}

/** Normalise submitter email; null empty, INVALID if bad shape. */
function normalizeSubmitterEmail(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.length > 254) return "INVALID";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "INVALID";
  return s;
}

export async function POST(request, { params }) {
  let connection;
  try {
    const { token: raw } = await params;
    const shipmentToken = String(raw ?? "").trim();
    if (!TOKEN_RE.test(shipmentToken)) {
      return NextResponse.json(
        { message: "Invalid shipment link" },
        { status: 404, headers: NO_STORE },
      );
    }

    const body = await request.json().catch(() => ({}));

    const emailNorm = normalizeSubmitterEmail(body?.submitter_email);
    if (emailNorm == null) {
      return NextResponse.json(
        { message: "Email is required.", code: "EMAIL_REQUIRED" },
        { status: 400, headers: NO_STORE },
      );
    }
    if (emailNorm === "INVALID") {
      return NextResponse.json(
        { message: "Please enter a valid email address.", code: "EMAIL_INVALID" },
        { status: 400, headers: NO_STORE },
      );
    }

    const nums = {};
    const keys = [
      "ocean_freight",
      "origin_cfs",
      "origin_customs",
      "origin_docs",
      "origin_vgm",
      "destination_cc_fee",
      "destination_thc",
      "destination_do_fee",
      "destination_deconsole_fee",
      "destination_gst",
      "clearance_agency",
      "clearance_loading",
      "clearance_edi",
      "clearance_exam",
      "clearance_cfs_actual",
      "clearance_transport_actual",
      "clearance_misc",
      "exchange_rate",
      "total_cost_inr",
    ];
    for (const k of keys) {
      const out = decOrNull(body?.[k]);
      if (out === "INVALID") {
        return NextResponse.json(
          { message: `Invalid number for ${k}` },
          { status: 400, headers: NO_STORE },
        );
      }
      nums[k] = out;
    }

    const agent_id = strOrNull(body?.agent_id);
    const remarks = strOrNull(body?.remarks);

    await ensureImportCrmTables();
    const pool = await getDbConnection();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [shipRows] = await connection.execute(
      `SELECT id FROM import_crm_shipments WHERE public_link_token = ? LIMIT 1`,
      [shipmentToken],
    );
    const ship = shipRows?.[0];
    if (!ship) {
      await connection.rollback();
      return NextResponse.json(
        { message: "Shipment link not found" },
        { status: 404, headers: NO_STORE },
      );
    }
    const shipmentId = ship.id;

    const [dupEmail] = await connection.execute(
      `SELECT id FROM import_crm_shipment_link_quotes
       WHERE shipment_id = ? AND submitter_email = ? AND public_link_token_at_submit = ?
       LIMIT 1`,
      [shipmentId, emailNorm, shipmentToken],
    );
    if (dupEmail?.[0]) {
      await connection.rollback();
      return NextResponse.json(
        {
          message: "You have already submitted.",
          code: "DUPLICATE_EMAIL",
        },
        { status: 409, headers: NO_STORE },
      );
    }

    const [result] = await connection.execute(
      `INSERT INTO import_crm_shipment_link_quotes (
        shipment_id, submitter_email, public_link_token_at_submit, agent_id,
        ocean_freight, origin_cfs, origin_customs, origin_docs, origin_vgm,
        destination_cc_fee, destination_thc, destination_do_fee, destination_deconsole_fee, destination_gst,
        clearance_agency, clearance_loading, clearance_edi, clearance_exam,
        clearance_cfs_actual, clearance_transport_actual, clearance_misc,
        exchange_rate, total_cost_inr, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shipmentId,
        emailNorm,
        shipmentToken,
        agent_id,
        nums.ocean_freight,
        nums.origin_cfs,
        nums.origin_customs,
        nums.origin_docs,
        nums.origin_vgm,
        nums.destination_cc_fee,
        nums.destination_thc,
        nums.destination_do_fee,
        nums.destination_deconsole_fee,
        nums.destination_gst,
        nums.clearance_agency,
        nums.clearance_loading,
        nums.clearance_edi,
        nums.clearance_exam,
        nums.clearance_cfs_actual,
        nums.clearance_transport_actual,
        nums.clearance_misc,
        nums.exchange_rate,
        nums.total_cost_inr,
        remarks,
      ],
    );

    await connection.commit();

    return NextResponse.json(
      { ok: true, id: result.insertId, message: "Submitted" },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        /* ignore */
      }
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        {
          message: "You have already submitted.",
          code: "DUPLICATE_EMAIL",
        },
        { status: 409, headers: NO_STORE },
      );
    }
    console.error("public-shipment quotation POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500, headers: NO_STORE },
    );
  } finally {
    if (connection) connection.release();
  }
}
