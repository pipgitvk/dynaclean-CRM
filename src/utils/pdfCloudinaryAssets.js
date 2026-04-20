/**
 * PDF / html2canvas assets: prefer Cloudinary HTTPS URLs so images are not
 * blocked by cross-origin or wrong host (service vs CRM domain).
 *
 * Env (optional):
 * - NEXT_PUBLIC_CLOUDINARY_PDF_LOGO_URL — full https URL of logo on Cloudinary (upload once).
 * - NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME — enables Cloudinary "fetch" delivery for signature images.
 */

const cloudName =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim()
    : "";

export function getPdfLogoUrl() {
  const fromCloudinary =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_CLOUDINARY_PDF_LOGO_URL?.trim()
      : "";
  if (fromCloudinary) return fromCloudinary;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/images/logo.png`;
  }
  return "/images/logo.png";
}

/** Base URL for /signatures/... when PDF is built from another domain (e.g. CRM vs service app). */
export function getPdfSignatureOrigin(windowOrigin) {
  const fixed =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_PDF_SIGNATURE_ORIGIN?.trim()
      : "";
  if (fixed) return fixed.replace(/\/$/, "");
  return String(windowOrigin || "").replace(/\/$/, "");
}

function deliveryUrlViaCloudinaryFetch(absoluteUrl) {
  if (!absoluteUrl || !cloudName) return absoluteUrl;
  if (!/^https?:\/\//i.test(absoluteUrl)) return absoluteUrl;
  if (/res\.cloudinary\.com\//i.test(absoluteUrl)) return absoluteUrl;
  try {
    const u = new URL(absoluteUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return absoluteUrl;
    }
  } catch {
    return absoluteUrl;
  }
  return `https://res.cloudinary.com/${cloudName}/image/fetch/f_auto,q_85/${encodeURIComponent(absoluteUrl)}`;
}

function absoluteUrlFromSignatureRef(raw, origin) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  const base = String(origin || "").replace(/\/$/, "");
  if (!base) return s.startsWith("/") ? s : `/signatures/${s}`;
  if (s.startsWith("/")) return `${base}${s}`;
  if (s.startsWith("signatures/")) return `${base}/${s}`;
  return `${base}/signatures/${s}`;
}

/**
 * @param {object} reportData
 * @param {'engineer'|'customer'} kind
 * @param {string} origin - e.g. window.location.origin
 */
export function signatureSrcForInstallationPdf(reportData, kind, origin) {
  const dataKey =
    kind === "engineer"
      ? "authorised_person_sign_data"
      : "customer_sign_data";
  const rawKey =
    kind === "engineer" ? "authorised_person_sign" : "customer_sign";
  const dataUrl = reportData?.[dataKey];
  if (dataUrl && String(dataUrl).trim().startsWith("data:")) {
    return String(dataUrl).trim();
  }
  const raw = reportData?.[rawKey];
  if (!raw) return "";
  const abs = absoluteUrlFromSignatureRef(raw, origin);
  if (!abs) return "";
  if (abs.startsWith("data:")) return abs;
  return deliveryUrlViaCloudinaryFetch(abs);
}
