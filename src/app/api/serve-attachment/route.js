export const dynamic = "force-dynamic";

import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const ALLOWED_PREFIXES = ["attachments/", "expense_attachments/", "completion_files/"];

function isPathSafe(cleaned) {
  if (!cleaned || cleaned.includes("..")) return false;
  return ALLOWED_PREFIXES.some((p) => cleaned.startsWith(p));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let pathParam = searchParams.get("path") || "";

    if (pathParam.startsWith("http")) {
      try {
        const u = new URL(pathParam);
        pathParam = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
      } catch {}
    }
    if (pathParam.startsWith("/")) pathParam = pathParam.slice(1);
    const cleaned = pathParam.replace(/^\/public\//, "").replace(/^public\//, "");

    if (!isPathSafe(cleaned)) {
      console.error("[serve-attachment] ERROR: invalid or unsafe path:", pathParam);
      return new Response("Forbidden", { status: 403 });
    }

    const fullPath = join(process.cwd(), "public", cleaned);
    if (!existsSync(fullPath)) {
      console.warn("[serve-attachment] NOT FOUND:", fullPath);
      return new Response("Not Found", { status: 404 });
    }

    const buffer = await readFile(fullPath);
    const ext = cleaned.split(".").pop()?.toLowerCase() || "";
    const mimeMap = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      pdf: "application/pdf",
      csv: "text/csv",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${cleaned.split("/").pop()}"`,
      },
    });
  } catch (err) {
    console.error("[serve-attachment] ERROR:", err?.message || err);
    return new Response("Server Error", { status: 500 });
  }
}
