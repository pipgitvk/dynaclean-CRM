import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureDocumentFromCompanyColumns } from "@/lib/ensureDocumentFromCompanyColumns";
import {
  canEditDocumentLetterhead,
  documentFromCompanyInsertValues,
  documentFromCompanyUpdateSetSql,
  letterheadPayloadForRole,
  pickDocumentFromCompanyFields,
} from "@/lib/documentFromCompany";

/** In-place letterhead update on existing quotation (no new quote version). */
export async function PATCH(req, { params }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  if (!canEditDocumentLetterhead(payload)) {
    return Response.json(
      { success: false, message: "Not allowed to edit letterhead" },
      { status: 403 },
    );
  }

  const { quoteId } = await params;
  if (!quoteId) {
    return Response.json({ success: false, message: "Missing quote number" }, { status: 400 });
  }

  const body = await req.json();
  const fields = pickDocumentFromCompanyFields(body);
  if (!Object.keys(fields).length) {
    return Response.json(
      { success: false, message: "No letterhead fields provided" },
      { status: 400 },
    );
  }

  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    await ensureDocumentFromCompanyColumns(conn);

    const [rows] = await conn.execute(
      "SELECT * FROM quotations_records WHERE quote_number = ? LIMIT 1",
      [quoteId],
    );
    if (!rows.length) {
      return Response.json(
        { success: false, message: "Quotation not found" },
        { status: 404 },
      );
    }

    const quote = rows[0];
    const letterhead = letterheadPayloadForRole(body, payload, quote);
    const docSet = documentFromCompanyUpdateSetSql();
    const docVals = documentFromCompanyInsertValues(letterhead);

    const [updateResult] = await conn.execute(
      `UPDATE quotations_records SET ${docSet} WHERE quote_number = ?`,
      [...docVals, quoteId],
    );
    if (!updateResult?.affectedRows) {
      return Response.json(
        { success: false, message: "Quotation letterhead was not updated" },
        { status: 404 },
      );
    }

    return Response.json({ success: true, letterhead });
  } catch (err) {
    console.error("[Quotation letterhead PATCH]", err);
    return Response.json(
      { success: false, message: err?.message || "Update failed" },
      { status: 500 },
    );
  } finally {
    conn.release?.();
  }
}
