import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getDbConnection } from "@/lib/db";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN_RE = /^[a-f0-9]{32,64}$/i;

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

function extOf(filename) {
  const s = String(filename || "");
  const i = s.lastIndexOf(".");
  if (i < 0) return "";
  return s.slice(i + 1).toLowerCase();
}

function safeBaseName(name) {
  const base = path.basename(String(name || "file"));
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "file";
}

async function loadQuoteByAwardToken(connection, token) {
  const [rows] = await connection.execute(
    `SELECT
       q.id,
       q.shipment_id,
       q.awarded_at,
       q.award_form_submitted_at,
       q.af_reassign_fields_json,
       q.af_pickup_person_details,
       q.af_supplier_address,
       q.af_cargo_ready_confirmation,
       q.af_booking_details,
       q.af_vessel_flight_details,
       q.af_container_details,
       q.af_bl_file,
       q.af_invoice_file,
       q.af_packing_list_file,
       q.af_other_documents_json,
       s.ship_from,
       s.ship_to,
       s.mode,
       s.shipment_term,
       s.cbm,
       s.material_ready_date,
       s.agent_delivery_deadline
     FROM import_crm_shipment_link_quotes q
     INNER JOIN import_crm_shipments s ON s.id = q.shipment_id
     WHERE q.award_portal_token = ?
       AND q.awarded_at IS NOT NULL
     LIMIT 1`,
    [token],
  );
  return rows?.[0] ?? null;
}

function parseFieldsJson(raw) {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

/** GET — meta + read-only data if already submitted */
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
    const pool = await getDbConnection();
    const connection = await pool.getConnection();
    try {
      const row = await loadQuoteByAwardToken(connection, token);
      if (!row) {
        return NextResponse.json(
          { message: "This link is not valid or the award was removed." },
          { status: 404, headers: NO_STORE },
        );
      }

      const submitted = Boolean(row.award_form_submitted_at);
      const reassignFields = parseFieldsJson(row.af_reassign_fields_json);
      // In re-assign mode the form is open again even if previously submitted
      const isReassign = Boolean(reassignFields);
      let otherDocs = [];
      if (row.af_other_documents_json) {
        try {
          const parsed = JSON.parse(row.af_other_documents_json);
          if (Array.isArray(parsed)) otherDocs = parsed;
        } catch {
          /* ignore */
        }
      }

      return NextResponse.json(
        {
          ok: true,
          submitted: submitted && !isReassign,
          reassign_fields: reassignFields,
          shipment: {
            id: String(row.shipment_id),
            ship_from: row.ship_from,
            ship_to: row.ship_to,
            mode: row.mode,
            shipment_term: row.shipment_term,
            cbm: row.cbm,
            material_ready_date: row.material_ready_date,
            agent_delivery_deadline: row.agent_delivery_deadline,
          },
          quoteId: row.id,
          form: {
            pickup_person_details: row.af_pickup_person_details,
            supplier_address: row.af_supplier_address,
            cargo_ready_confirmation: row.af_cargo_ready_confirmation,
            booking_details: row.af_booking_details,
            vessel_flight_details: row.af_vessel_flight_details,
            container_details: row.af_container_details,
            bl_file: row.af_bl_file,
            invoice_file: row.af_invoice_file,
            packing_list_file: row.af_packing_list_file,
            other_documents: otherDocs,
          },
        },
        { headers: NO_STORE },
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("public-award GET:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500, headers: NO_STORE },
    );
  }
}

function strField(formData, key) {
  const v = formData.get(key);
  if (v == null) return "";
  return String(v).trim();
}

async function saveUploadedFile(quoteId, fieldName, file) {
  if (!file || typeof file.arrayBuffer !== "function") return null;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return null;
  if (buf.length > MAX_FILE_BYTES) {
    throw new Error(`${fieldName}: file too large (max 15 MB)`);
  }
  const orig = safeBaseName(file.name);
  const ext = extOf(orig);
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(
      `${fieldName}: type not allowed (use PDF, images, Word, or Excel)`,
    );
  }
  const stored = `${randomUUID()}_${orig}`;
  const dir = path.join(
    process.cwd(),
    "uploads",
    "import-crm-award",
    String(quoteId),
  );
  await mkdir(dir, { recursive: true });
  const full = path.join(dir, stored);
  await writeFile(full, buf);
  return path.posix.join(
    "import-crm-award",
    String(quoteId),
    stored,
  );
}

/** POST — multipart form submit */
export async function POST(request, { params }) {
  let connection;
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
    const pool = await getDbConnection();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const row = await loadQuoteByAwardToken(connection, token);
    if (!row) {
      await connection.rollback();
      return NextResponse.json(
        { message: "This link is not valid or the award was removed." },
        { status: 404, headers: NO_STORE },
      );
    }
    const reassignFields = parseFieldsJson(row.af_reassign_fields_json);
    const isReassign = Boolean(reassignFields);

    if (row.award_form_submitted_at && !isReassign) {
      await connection.rollback();
      return NextResponse.json(
        { message: "This form was already submitted.", code: "ALREADY_SUBMITTED" },
        { status: 409, headers: NO_STORE },
      );
    }

    const quoteId = row.id;
    const formData = await request.formData();

    const pickup_person_details = strField(formData, "pickup_person_details");
    const supplier_address = strField(formData, "supplier_address");
    const cargo_ready_confirmation = strField(formData, "cargo_ready_confirmation");
    const booking_details = strField(formData, "booking_details");
    const vessel_flight_details = strField(formData, "vessel_flight_details");
    const container_details = strField(formData, "container_details");

    // For a full submission, pickup + supplier address are required.
    // For partial re-assign, only validate fields that are in the reassign list.
    const mustFill = isReassign ? reassignFields : ["pickup_person_details", "supplier_address"];
    if (mustFill.includes("pickup_person_details") && !pickup_person_details) {
      await connection.rollback();
      return NextResponse.json(
        { message: "Pickup person details are required." },
        { status: 400, headers: NO_STORE },
      );
    }
    if (mustFill.includes("supplier_address") && !supplier_address) {
      await connection.rollback();
      return NextResponse.json(
        { message: "Supplier address is required." },
        { status: 400, headers: NO_STORE },
      );
    }

    const blFile = formData.get("bl_upload");
    const invFile = formData.get("invoice_upload");
    const plFile = formData.get("packing_list_upload");

    let af_bl_file = null;
    let af_invoice_file = null;
    let af_packing_list_file = null;
    try {
      if (blFile && typeof blFile === "object" && blFile.size > 0) {
        af_bl_file = await saveUploadedFile(quoteId, "BL", blFile);
      }
      if (invFile && typeof invFile === "object" && invFile.size > 0) {
        af_invoice_file = await saveUploadedFile(quoteId, "Invoice", invFile);
      }
      if (plFile && typeof plFile === "object" && plFile.size > 0) {
        af_packing_list_file = await saveUploadedFile(quoteId, "Packing list", plFile);
      }
    } catch (fileErr) {
      await connection.rollback();
      return NextResponse.json(
        { message: String(fileErr?.message || fileErr) },
        { status: 400, headers: NO_STORE },
      );
    }

    const otherEntries = formData.getAll("other_documents");
    const otherMeta = [];
    for (const f of otherEntries) {
      if (f && typeof f === "object" && f.size > 0) {
        try {
          const rel = await saveUploadedFile(quoteId, "Other document", f);
          if (rel) otherMeta.push({ path: rel, name: safeBaseName(f.name) });
        } catch (fileErr) {
          await connection.rollback();
          return NextResponse.json(
            { message: String(fileErr?.message || fileErr) },
            { status: 400, headers: NO_STORE },
          );
        }
      }
    }

    // Build update: for re-assign, only touch the selected fields; for full, touch all.
    const setParts = [];
    const setVals = [];

    const shouldUpdate = (key) => !isReassign || reassignFields.includes(key);

    if (shouldUpdate("pickup_person_details")) {
      setParts.push("af_pickup_person_details = ?");
      setVals.push(pickup_person_details || null);
    }
    if (shouldUpdate("supplier_address")) {
      setParts.push("af_supplier_address = ?");
      setVals.push(supplier_address || null);
    }
    if (shouldUpdate("cargo_ready_confirmation")) {
      setParts.push("af_cargo_ready_confirmation = ?");
      setVals.push(cargo_ready_confirmation || null);
    }
    if (shouldUpdate("booking_details")) {
      setParts.push("af_booking_details = ?");
      setVals.push(booking_details || null);
    }
    if (shouldUpdate("vessel_flight_details")) {
      setParts.push("af_vessel_flight_details = ?");
      setVals.push(vessel_flight_details || null);
    }
    if (shouldUpdate("container_details")) {
      setParts.push("af_container_details = ?");
      setVals.push(container_details || null);
    }
    if (shouldUpdate("bl_file")) {
      setParts.push("af_bl_file = ?");
      setVals.push(af_bl_file);
    }
    if (shouldUpdate("invoice_file")) {
      setParts.push("af_invoice_file = ?");
      setVals.push(af_invoice_file);
    }
    if (shouldUpdate("packing_list_file")) {
      setParts.push("af_packing_list_file = ?");
      setVals.push(af_packing_list_file);
    }
    if (shouldUpdate("other_documents")) {
      setParts.push("af_other_documents_json = ?");
      setVals.push(otherMeta.length ? JSON.stringify(otherMeta) : null);
    }

    // Always update submission timestamp and clear the reassign fields marker
    setParts.push("award_form_submitted_at = CURRENT_TIMESTAMP");
    setParts.push("af_reassign_fields_json = NULL");
    setVals.push(quoteId, token);

    await connection.execute(
      `UPDATE import_crm_shipment_link_quotes
       SET ${setParts.join(", ")}
       WHERE id = ? AND award_portal_token = ? AND awarded_at IS NOT NULL`,
      setVals,
    );

    await connection.execute(
      `UPDATE import_crm_shipments SET status = 'EXECUTION_APPROVED' WHERE id = ?`,
      [row.shipment_id],
    );

    await connection.commit();
    return NextResponse.json(
      { ok: true, message: "Thank you — your details were submitted." },
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
    console.error("public-award POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500, headers: NO_STORE },
    );
  } finally {
    if (connection) connection.release();
  }
}
