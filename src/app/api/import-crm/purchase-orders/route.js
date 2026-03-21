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
      `SELECT p.id, p.po_number, p.supplier_id, p.po_date, p.currency, p.total_value, p.remarks,
              p.created_at, p.updated_at,
              s.supplier_name
       FROM import_crm_purchase_orders p
       INNER JOIN import_crm_suppliers s ON s.id = p.supplier_id
       ORDER BY p.po_date DESC, p.id DESC`,
    );
    return NextResponse.json({ purchase_orders: rows });
  } catch (error) {
    console.error("import-crm purchase-orders GET:", error);
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
    const po_number = String(body?.po_number ?? "").trim();
    const supplier_id = Number(body?.supplier_id);
    const po_date = String(body?.po_date ?? "").trim();
    const currency = String(body?.currency ?? "INR").trim() || "INR";
    const totalRaw = body?.total_value;
    const remarks = body?.remarks != null ? String(body.remarks).trim() : null;

    if (!po_number || !po_date || !Number.isFinite(supplier_id) || supplier_id < 1) {
      return NextResponse.json(
        { message: "po_number, supplier_id, and po_date are required" },
        { status: 400 },
      );
    }

    const total_value =
      totalRaw === "" || totalRaw === null || totalRaw === undefined
        ? 0
        : Number(totalRaw);
    if (!Number.isFinite(total_value) || total_value < 0) {
      return NextResponse.json(
        { message: "total_value must be a valid non-negative number" },
        { status: 400 },
      );
    }

    await ensureImportCrmTables();
    const db = await getDbConnection();
    const [result] = await db.query(
      `INSERT INTO import_crm_purchase_orders
        (po_number, supplier_id, po_date, currency, total_value, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [po_number, supplier_id, po_date, currency, total_value, remarks || null],
    );

    return NextResponse.json(
      { id: result.insertId, message: "Purchase order created" },
      { status: 201 },
    );
  } catch (error) {
    console.error("import-crm purchase-orders POST:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "A purchase order with this PO number already exists" },
        { status: 409 },
      );
    }
    if (error?.code === "ER_NO_REFERENCED_ROW_2" || error?.errno === 1452) {
      return NextResponse.json(
        { message: "Invalid supplier" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
