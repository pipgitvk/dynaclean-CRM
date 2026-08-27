const FILE_SERVE_PREFIX = "/api/serve/";

const isExternalUrl = (url) => /^https?:\/\//i.test(url);

function encodePathSegment(segment) {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

/**
 * Turn stored file paths (/Order/accounts/..., /uploads/..., etc.) into URLs
 * served via /api/serve so production can read from disk reliably.
 */
export function resolveStoredFileUrl(raw) {
  if (!raw) return "";
  const value = String(raw).trim();
  if (!value) return "";
  if (isExternalUrl(value) || value.startsWith(FILE_SERVE_PREFIX)) {
    return value;
  }

  // Only split a real query string. Filenames may contain "#" (e.g. "PO # 123.pdf")
  // and must not be treated as URL fragments.
  let pathPart = value;
  let query = "";

  const queryIndex = pathPart.indexOf("?");
  if (queryIndex !== -1) {
    query = pathPart.slice(queryIndex + 1);
    pathPart = pathPart.slice(0, queryIndex);
  }

  const normalized = pathPart.replace(/^\/+/, "");
  if (!normalized) return value;

  const lastSegment = normalized.split("/").pop();
  if (!lastSegment || !lastSegment.includes(".")) {
    return value;
  }

  const encodedPath = normalized
    .split("/")
    .filter(Boolean)
    .map(encodePathSegment)
    .join("/");

  const querySuffix = query ? `?${query}` : "";

  return `${FILE_SERVE_PREFIX}${encodedPath}${querySuffix}`;
}
