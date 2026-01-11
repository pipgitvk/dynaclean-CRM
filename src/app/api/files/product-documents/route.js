// src/app/api/files/product-documents/route.js
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "public", "product_documents");

function contentTypeFor(ext) {
  switch (ext.toLowerCase()) {
    case ".pdf": return "application/pdf";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    default: return "application/octet-stream";
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get("path") || ""; // expected like /product_documents/manuals/filename.pdf

    if (!rawPath || !rawPath.startsWith("/product_documents/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Normalize and lock to ROOT
    const rel = rawPath.replace(/^\/product_documents\//, "");
    // Prevent path traversal
    if (rel.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const abs = path.join(ROOT, rel);

    // Ensure requested file is within ROOT
    if (!abs.startsWith(ROOT)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Read file
    const data = await fs.readFile(abs);
    const ext = path.extname(abs);

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(ext),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": ext === ".pdf" ? "inline" : "attachment",
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("/api/files/product-documents error:", err);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
