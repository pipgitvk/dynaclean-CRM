import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";
import { generateImportCrmQuoteToken } from "@/lib/generateImportCrmQuoteToken";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

/** New public share token. Old URLs stop working; quote rows are kept. Same email can submit again on the new URL (duplicate check is per token). */
export async function POST(_request, { params }) {
  let connection;
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
    const pool = await getDbConnection();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [exists] = await connection.execute(
      `SELECT id FROM import_crm_shipments WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!exists?.[0]) {
      await connection.rollback();
      return NextResponse.json({ message: "Shipment not found" }, { status: 404 });
    }

    let publicToken = generateImportCrmQuoteToken();
    let updated = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const [result] = await connection.execute(
          `UPDATE import_crm_shipments
           SET public_link_token = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [publicToken, id],
        );
        if (result.affectedRows === 0) {
          await connection.rollback();
          return NextResponse.json(
            { message: "Shipment not found" },
            { status: 404 },
          );
        }
        updated = true;
        break;
      } catch (err) {
        if (err?.code === "ER_DUP_ENTRY" && attempt < 5) {
          publicToken = generateImportCrmQuoteToken();
          continue;
        }
        await connection.rollback();
        throw err;
      }
    }

    if (!updated) {
      await connection.rollback();
      return NextResponse.json(
        { message: "Could not generate unique link" },
        { status: 500 },
      );
    }

    await connection.commit();
    return NextResponse.json({
      ok: true,
      public_link_token: publicToken,
      message: "Share link regenerated",
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        /* ignore */
      }
    }
    console.error("regenerate-public-link POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  } finally {
    if (connection) connection.release();
  }
}
