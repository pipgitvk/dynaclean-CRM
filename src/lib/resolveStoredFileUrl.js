const FILE_SERVE_PREFIX = "/api/serve/";

const isExternalUrl = (url) => /^https?:\/\//i.test(url);

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

  let pathPart = value;
  let hash = "";
  let query = "";

  const hashIndex = pathPart.indexOf("#");
  if (hashIndex !== -1) {
    hash = pathPart.slice(hashIndex);
    pathPart = pathPart.slice(0, hashIndex);
  }

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
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const querySuffix = query ? `?${query}` : "";

  return `${FILE_SERVE_PREFIX}${encodedPath}${querySuffix}${hash}`;
}
