import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[a-f0-9]{32,64}$/i;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

function dateOnly(value) {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  return s === "" ? null : s.slice(0, 10);
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
      `SELECT s.id, s.ship_from, s.ship_to, s.cbm, s.shipment_term, s.mode,
              s.material_ready_date, s.agent_delivery_deadline, s.remarks
       FROM import_crm_shipments s
       WHERE s.public_link_token = ?
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

    return NextResponse.json(
      {
        ok: true,
        already_submitted: false,
        shipment: {
          ship_from: row.ship_from,
          ship_to: row.ship_to,
          cbm: row.cbm != null ? Number(row.cbm) : null,
          shipment_term: row.shipment_term,
          mode: row.mode,
          material_ready_date: dateOnly(row.material_ready_date),
          agent_delivery_deadline: dateOnly(row.agent_delivery_deadline),
          remarks: row.remarks,
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("public-shipment GET:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500, headers: NO_STORE },
    );
  }
}
