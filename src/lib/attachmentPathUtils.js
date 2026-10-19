// Pure string helpers — safe to import from Client Components (no Node fs/path).

export const ATTACHMENT_DOMAINS = [
  "https://app.dynacleanindustries.com",
  "https://service.dynacleanindustries.com",
];

/** Attendance regularization uploads from service CRM live on this host. */
export const ATTENDANCE_REGULARIZATION_SERVICE_ORIGIN =
  process.env.ATTENDANCE_REGULARIZATION_SERVICE_ORIGIN ||
  "https://service.dynacleanindustries.com";

/** Service CRM Cloudinary account (often different from app CRM). */
export function getServiceCloudinaryCloudName() {
  return (
    process.env.SERVICE_CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.ATTENDANCE_REGULARIZATION_SERVICE_CLOUDINARY_CLOUD_NAME?.trim() ||
    ""
  );
}

/** App CRM Cloudinary account. */
export function getAppCloudinaryCloudName() {
  return process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";
}

const OWNED_HOSTS = new Set([
  "app.dynacleanindustries.com",
  "service.dynacleanindustries.com",
  "localhost",
  "127.0.0.1",
]);

export function normalizeAttachmentPathParam(path) {
  let p = path || "";
  try {
    if (p.startsWith("http")) {
      const u = new URL(p);
      // Keep external URLs (e.g. Cloudinary) as full URLs.
      if (!OWNED_HOSTS.has(u.hostname)) {
        return u.toString();
      }
      p = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    }
  } catch {}
  if (p && !p.startsWith("/")) p = `/${p}`;
  return p;
}

/** Split DB attachment field (comma-separated paths; may be ", " or ","). */
export function splitAttachmentList(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s ?? "").trim()).filter(Boolean);
  }
  let text = "";
  if (typeof raw === "string") {
    text = raw;
  } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    text = raw.toString("utf8");
  } else {
    text = String(raw);
  }
  if (!text.trim()) return [];
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Remove leading slashes from path to prevent double slash URLs in Next.js public folder */
export function removeLeadingSlashes(path) {
  if (!path || typeof path !== "string") return path;
  return path.replace(/^\/+/, "");
}

/** Normalize a single DB attachment token to a site path under attachments/ or completion_files/. */
export function attachmentStoragePath(raw) {
  const piece = String(raw || "").trim();
  if (!piece) return "";
  if (piece.startsWith("http://") || piece.startsWith("https://")) {
    return normalizeAttachmentPathParam(piece);
  }
  let path = piece.replace(/^\/+/, "");
  if (
    path.startsWith("attachments/") ||
    path.startsWith("completion_files/") ||
    path.startsWith("expense_attachments/")
  ) {
    return path;
  }
  // Service completion uploads are often stored as bare filenames under completion_files/
  if (!path.includes("/")) {
    return `completion_files/${path}`;
  }
  return `attachments/${path}`;
}

/** Browser href: local disk, app host, or service host (via /api/open-attachment). */
export function attachmentOpenHref(raw) {
  const piece = String(raw ?? "").trim();
  if (!piece || piece === "null" || piece === "undefined") return null;
  if (piece.startsWith("http://") || piece.startsWith("https://")) {
    return piece;
  }
  const storagePath = attachmentStoragePath(piece);
  if (!storagePath) return null;
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  const path = normalizeAttachmentPathParam(storagePath);
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `/api/open-attachment?path=${encodeURIComponent(path)}`;
}

/** Always returns a usable href when raw attachment text is non-empty. */
export function attachmentHrefForUi(raw) {
  const direct = attachmentOpenHref(raw);
  if (direct) return direct;
  const serve = attachmentServeHref(raw);
  if (serve) return serve;
  const piece = String(raw ?? "").trim();
  if (!piece) return null;
  if (piece.startsWith("http://") || piece.startsWith("https://")) {
    return piece;
  }
  const path = normalizeAttachmentPathParam(
    piece.startsWith("/") ? piece : `/attachments/${piece.replace(/^\/+/, "")}`,
  );
  return `/api/open-attachment?path=${encodeURIComponent(path)}`;
}

/** Path query for /api/serve-attachment (local public/ only). */
export function attachmentServeHref(raw) {
  const storagePath = attachmentStoragePath(raw);
  if (!storagePath || storagePath.startsWith("http")) return null;
  return `/api/serve-attachment?path=${encodeURIComponent(storagePath)}`;
}
