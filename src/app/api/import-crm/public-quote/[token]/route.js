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

export async function GET(_request, { params }) {
  try {
    const { token: raw } = await params;
    const token = String(raw ?? "").trim();
    if (!TOKEN_RE.test(token)) {
      return NextResponse.json(
        { message: "Invalid link" },
        { status: 404, headers: NO_STORE },
      );
    }
    await ensureImportCrmTables();
    const db = await getDbConnection();
    const [rows] = await db.query(
      `SELECT supplier_name, import_quote_submitted_at
       FROM import_crm_suppliers
       WHERE quote_link_token = ?
       LIMIT 1`,
      [token],
    );
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json(
        { message: "Link not found" },
        { status: 404, headers: NO_STORE },
      );
    }
    const alreadySubmitted = row.import_quote_submitted_at != null;
    return NextResponse.json(
      {
        ok: true,
        supplier_name: row.supplier_name,
        already_submitted: alreadySubmitted,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("public-quote GET:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function POST(request, { params }) {
  let connection;
  try {
    const { token: raw } = await params;
    const token = String(raw ?? "").trim();
    if (!TOKEN_RE.test(token)) {
      return NextResponse.json({ message: "Invalid link" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

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
          { status: 400 },
        );
      }
      nums[k] = out;
    }

    const shipment_id = strOrNull(body?.shipment_id);
    const agent_id = strOrNull(body?.agent_id);
    const remarks = strOrNull(body?.remarks);

    await ensureImportCrmTables();
    const pool = await getDbConnection();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [locked] = await connection.execute(
      `SELECT id, import_quote_submitted_at
       FROM import_crm_suppliers
       WHERE quote_link_token = ?
       LIMIT 1
       FOR UPDATE`,
      [token],
    );
    const supplier = locked?.[0];
    if (!supplier) {
      await connection.rollback();
      return NextResponse.json({ message: "Link not found" }, { status: 404 });
    }
    if (supplier.import_quote_submitted_at != null) {
      await connection.rollback();
      return NextResponse.json(
        { message: "This form has already been submitted." },
        { status: 409 },
      );
    }

    const supplierId = supplier.id;
    const [result] = await connection.execute(
      `INSERT INTO import_crm_quotations (
        supplier_id, shipment_id, agent_id,
        ocean_freight, origin_cfs, origin_customs, origin_docs, origin_vgm,
        destination_cc_fee, destination_thc, destination_do_fee, destination_deconsole_fee, destination_gst,
        clearance_agency, clearance_loading, clearance_edi, clearance_exam,
        clearance_cfs_actual, clearance_transport_actual, clearance_misc,
        exchange_rate, total_cost_inr, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplierId,
        shipment_id,
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

    await connection.execute(
      `UPDATE import_crm_suppliers
       SET import_quote_submitted_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [supplierId],
    );

    await connection.commit();

    return NextResponse.json(
      { ok: true, id: result.insertId, message: "Submitted" },
      { status: 201 },
    );
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        /* ignore */
      }
    }
    console.error("public-quote POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  } finally {
    if (connection) connection.release();
  }
}
