import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
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
      `SELECT id, supplier_name, country, contact_person, email, phone, address,
              created_at, updated_at
       FROM import_crm_suppliers
       ORDER BY supplier_name ASC`,
    );
    return NextResponse.json({ suppliers: rows });
  } catch (error) {
    console.error("import-crm suppliers GET:", error);
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
    const supplier_name = String(body?.supplier_name ?? "").trim();
    if (!supplier_name) {
      return NextResponse.json(
        { message: "supplier_name is required" },
        { status: 400 },
      );
    }

    const country = body?.country != null ? String(body.country).trim() : null;
    const contact_person =
      body?.contact_person != null ? String(body.contact_person).trim() : null;
    const email = body?.email != null ? String(body.email).trim() : null;
    const phone = body?.phone != null ? String(body.phone).trim() : null;
    const address = body?.address != null ? String(body.address).trim() : null;

    await ensureImportCrmTables();
    const db = await getDbConnection();
    const [result] = await db.query(
      `INSERT INTO import_crm_suppliers
        (supplier_name, country, contact_person, email, phone, address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [supplier_name, country || null, contact_person || null, email || null, phone || null, address || null],
    );

    return NextResponse.json(
      { id: result.insertId, message: "Supplier created" },
      { status: 201 },
    );
  } catch (error) {
    console.error("import-crm suppliers POST:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
