/**
 * Turn stored profile paths (/employee_profiles/...) into URLs that load via API
 * so production works even when static /public serving or deploy wipes are flaky.
 * Absolute http(s) URLs (e.g. Cloudinary) pass through unchanged.
 */
export function profileAssetViewUrl(url) {
  if (url == null || typeof url !== "string") return url;
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const p = u.pathname || "";
      if (p.startsWith("/employee_profiles/")) {
        const rel = p.replace(/^\/+/, "");
        return `/api/empcrm/profile-asset?path=${encodeURIComponent(rel)}`;
      }
    } catch {
      /* keep original */
    }
    return t;
  }
  if (t.startsWith("/employee_profiles/")) {
    const rel = t.replace(/^\/+/, "");
    return `/api/empcrm/profile-asset?path=${encodeURIComponent(rel)}`;
  }
  return t;
}
