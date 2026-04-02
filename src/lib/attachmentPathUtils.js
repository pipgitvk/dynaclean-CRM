// Pure string helpers — safe to import from Client Components (no Node fs/path).

export const ATTACHMENT_DOMAINS = [
  "https://app.dynacleanindustries.com",
  "https://service.dynacleanindustries.com",
];

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
