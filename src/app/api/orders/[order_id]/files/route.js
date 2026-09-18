import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { uploadOrderAccountBuffer } from "@/lib/uploadOrderAccountFile";

const MAX_FILES_PER_FIELD = 5;

const ALLOWED_FIELDS = {
  payment_proof: "payment_proof",
  po_file: "po_file",
  report_file: "report_file",
  ewaybill_file: "ewaybill_file",
  einvoice_file: "einvoice_file",
  deliverchallan: "deliverchallan",
  delivery_proof: "delivery_proof",
};

function parseStoredPaths(value) {
  return String(value || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

export async function POST(request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { order_id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    const formData = await request.formData();
    const field = String(formData.get("field") || "");
    const column = ALLOWED_FIELDS[field];

    if (!column) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }

    const incomingFiles = formData
      .getAll("files")
      .filter((file) => file && typeof file === "object" && file.size > 0);

    if (incomingFiles.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT \`${column}\` AS file_value FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId],
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const existing = parseStoredPaths(rows[0].file_value);
    const remaining = MAX_FILES_PER_FIELD - existing.length;

    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_FIELD} files allowed for this field` },
        { status: 400 },
      );
    }

    const toUpload = incomingFiles.slice(0, remaining);
    const uploadedPaths = [];

    for (const file of toUpload) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const savedPath = await uploadOrderAccountBuffer(buffer, file.name);
      uploadedPaths.push(savedPath);
    }

    const mergedValue = [...existing, ...uploadedPaths].join(",");
    await conn.execute(
      `UPDATE neworder SET \`${column}\` = ? WHERE order_id = ?`,
      [mergedValue, orderId],
    );

    return NextResponse.json({
      success: true,
      field,
      value: mergedValue,
      added: uploadedPaths.length,
      skipped: incomingFiles.length - toUpload.length,
    });
  } catch (error) {
    console.error("❌ Order file upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 },
    );
  }
}
