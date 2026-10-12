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
  if (!raw || typeof raw !== "string") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Remove leading slashes from path to prevent double slash URLs in Next.js public folder */
export function removeLeadingSlashes(path) {
  if (!path || typeof path !== "string") return path;
  return path.replace(/^\/+/, '');
}
