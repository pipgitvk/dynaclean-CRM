import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureImportCrmTables } from "@/lib/ensureImportCrmTables";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

function str(body, key) {
  const v = body?.[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
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
      `SELECT
         id,
         supplier_name,
         contact_person,
         email,
         phone,
         alt_phone,
         country,
         state,
         city,
         address,
         pincode,
         factory_name,
         supplier_type,
         main_products,
         pickup_address,
         gst_no,
         pan_no,
         iec_no,
         tax_registration_no,
         registration_no,
         default_origin_country,
         default_origin_city,
         nearest_port,
         default_incoterm,
         cargo_ready_lead_time,
         bank_name,
         account_holder_name,
         account_number,
         swift_code,
         branch_name,
         available_documents,
         remarks,
         status,
         created_at,
         updated_at
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

    const status = str(body, "status") || "Active";

    await ensureImportCrmTables();
    const db = await getDbConnection();

    const [result] = await db.query(
      `INSERT INTO import_crm_suppliers (
        supplier_name,
        contact_person,
        email,
        phone,
        alt_phone,
        country,
        state,
        city,
        address,
        pincode,
        factory_name,
        supplier_type,
        main_products,
        pickup_address,
        gst_no,
        pan_no,
        iec_no,
        tax_registration_no,
        registration_no,
        default_origin_country,
        default_origin_city,
        nearest_port,
        default_incoterm,
        cargo_ready_lead_time,
        bank_name,
        account_holder_name,
        account_number,
        swift_code,
        branch_name,
        available_documents,
        remarks,
        status,
        quote_link_token
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL
      )`,
      [
        supplier_name,
        str(body, "contact_person"),
        str(body, "email"),
        str(body, "phone"),
        str(body, "alt_phone"),
        str(body, "country"),
        str(body, "state"),
        str(body, "city"),
        str(body, "address"),
        str(body, "pincode"),
        str(body, "factory_name"),
        str(body, "supplier_type"),
        str(body, "main_products"),
        str(body, "pickup_address"),
        str(body, "gst_no"),
        str(body, "pan_no"),
        str(body, "iec_no"),
        str(body, "tax_registration_no"),
        str(body, "registration_no"),
        str(body, "default_origin_country"),
        str(body, "default_origin_city"),
        str(body, "nearest_port"),
        str(body, "default_incoterm"),
        str(body, "cargo_ready_lead_time"),
        str(body, "bank_name"),
        str(body, "account_holder_name"),
        str(body, "account_number"),
        str(body, "swift_code"),
        str(body, "branch_name"),
        str(body, "available_documents"),
        str(body, "remarks"),
        status,
      ],
    );

    return NextResponse.json(
      {
        id: result.insertId,
        message: "Supplier created",
      },
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
