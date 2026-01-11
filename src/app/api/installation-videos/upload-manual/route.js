// src/app/api/installation-videos/upload-manual/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "product_documents", "manuals");
const ALLOWED = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function validateFile(file) {
  if (!file) return { ok: false, error: "No file provided" };
  if (file.size > MAX_SIZE) return { ok: false, error: "File too large (max 20MB)" };
  if (!ALLOWED[file.type]) return { ok: false, error: "Unsupported type. Use PDF, DOCX, JPG, or PNG" };
  return { ok: true };
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const id = form.get("id");
    const item_code = form.get("item_code");
    const file = form.get("file");

    if (!id && !item_code) {
      return NextResponse.json({ error: "id or item_code is required" }, { status: 400 });
    }

    const v = validateFile(file);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    // Ensure upload dir
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Build filename
    const base = (item_code || `id_${id}` || "unknown").toString().replace(/[^a-zA-Z0-9_.-]/g, "_");
    const ext = ALLOWED[file.type];
    const filename = `${base}_manual_${Date.now()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Public URL path
    const publicPath = `/product_documents/manuals/${filename}`;

    // Update DB
    const conn = await getDbConnection();
    let sql = ""; let params = [];
    if (id) { sql = "UPDATE products_list SET user_manual_link = ? WHERE id = ?"; params = [publicPath, id]; }
    else { sql = "UPDATE products_list SET user_manual_link = ? WHERE item_code = ?"; params = [publicPath, item_code]; }
    const [result] = await conn.execute(sql, params);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "No matching product" }, { status: 404 });
    }

    return NextResponse.json({ success: true, path: publicPath });
  } catch (err) {
    console.error("upload-manual error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
