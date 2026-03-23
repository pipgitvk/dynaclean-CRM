import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

/** Approve a submitted award follow-up form. */
export async function POST(_request, { params }) {
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

    const [found] = await db.query(
      `SELECT id, award_form_submitted_at, af_approved_at
       FROM import_crm_shipment_link_quotes WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = found?.[0];
    if (!row) {
      return NextResponse.json(
        { message: "Follow-up not found" },
        { status: 404 },
      );
    }
    if (!row.award_form_submitted_at) {
      return NextResponse.json(
        { message: "Cannot approve: follow-up form not yet submitted." },
        { status: 409 },
      );
    }
    if (row.af_approved_at) {
      return NextResponse.json(
        { message: "Already approved.", already: true },
        { status: 200 },
      );
    }

    const [updated] = await db.query(
      `UPDATE import_crm_shipment_link_quotes
       SET af_approved_at = CURRENT_TIMESTAMP, af_approved_by = ?
       WHERE id = ?`,
      [payload.username || null, id],
    );

    if (updated.affectedRows > 0) {
      const [qrows] = await db.query(
        `SELECT shipment_id FROM import_crm_shipment_link_quotes WHERE id = ? LIMIT 1`,
        [id],
      );
      const shipmentId = qrows?.[0]?.shipment_id;
      if (shipmentId) {
        await db.query(
          `UPDATE import_crm_shipments SET status = 'APPROVED_FOR_MOVEMENT' WHERE id = ?`,
          [shipmentId],
        );
      }
    }

    return NextResponse.json({ ok: true, message: "Follow-up approved." });
  } catch (error) {
    console.error("import-crm award-followups approve POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
