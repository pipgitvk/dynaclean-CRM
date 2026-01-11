// src/app/api/files/task/route.js
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Serve files from public/task (images, videos, and any docs saved there)
const ROOT = path.join(process.cwd(), "public", "task");

function contentTypeFor(ext) {
  switch (ext.toLowerCase()) {
    case ".pdf": return "application/pdf";
    case ".doc": return "application/msword";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xls": return "application/vnd.ms-excel";
    case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".gif": return "image/gif";
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    default: return "application/octet-stream";
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get("path") || ""; // e.g. /task/images/filename.pdf

    if (!rawPath || !rawPath.startsWith("/task/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Normalize and lock to ROOT
    const rel = rawPath.replace(/^\/task\//, "");
    // Prevent path traversal
    if (rel.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const abs = path.join(ROOT, rel);

    // Ensure requested file is within ROOT
    if (!abs.startsWith(ROOT)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const data = await fs.readFile(abs);
    const ext = path.extname(abs);

    const mime = contentTypeFor(ext);
    const inlineExts = new Set([".pdf", ".jpg", ".jpeg", ".png", ".gif", ".mp4", ".webm"]);
    const isInline = inlineExts.has(ext.toLowerCase());

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": mime,
        // Cache static assets aggressively
        "Cache-Control": "public, max-age=31536000, immutable",
        // Render common media inline for viewing in-browser; download others by default
        "Content-Disposition": isInline ? "inline" : "attachment",
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("/api/files/task error:", err);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}