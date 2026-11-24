import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const SERVE_ATTACHMENT_PREFIXES = [
  "attachments/",
  "expense_attachments/",
  "completion_files/",
  "attendance_regularization/",
  "uploads/regularization/",
];

export function isServeAttachmentPathSafe(cleaned) {
  if (!cleaned || cleaned.includes("..")) return false;
  return SERVE_ATTACHMENT_PREFIXES.some((p) => cleaned.startsWith(p));
}

export function normalizeServeAttachmentPathParam(pathParam) {
  let p = String(pathParam || "").trim();
  if (!p) return "";

  if (p.startsWith("http://") || p.startsWith("https://")) {
    try {
      const u = new URL(p);
      p = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    } catch {
      return "";
    }
  }
  if (p.startsWith("/")) p = p.slice(1);
  return p.replace(/^\/public\//, "").replace(/^public\//, "");
}

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  csv: "text/csv",
};

export function contentTypeForAttachmentPath(cleaned) {
  const ext = String(cleaned || "").split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

/** Read a file from public/ when path is under allowed attachment prefixes. */
export async function readPublicAttachmentFile(cleaned) {
  if (!isServeAttachmentPathSafe(cleaned)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const fullPath = join(process.cwd(), "public", cleaned);
  if (!existsSync(fullPath)) {
    return { ok: false, status: 404, error: "Not Found" };
  }

  const buffer = await readFile(fullPath);
  const contentType = contentTypeForAttachmentPath(cleaned);
  const fileName = cleaned.split("/").pop() || "file";
  return { ok: true, buffer, contentType, fileName };
}