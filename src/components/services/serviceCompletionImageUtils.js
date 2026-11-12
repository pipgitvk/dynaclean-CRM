import { attachmentStoragePath } from "@/lib/attachmentPathUtils";

export const parseCompletionImageList = (value) =>
  value
    ? String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

export function completionImageStoragePath(filePath) {
  const trimmed = String(filePath || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return attachmentStoragePath(trimmed);
}

export function getCompletionImageSrc(filePath) {
  if (!filePath) return "";
  const trimmed = String(filePath).trim();
  if (trimmed.includes("res.cloudinary.com")) {
    return `/api/cloudinary-proxy?url=${encodeURIComponent(trimmed)}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const host = new URL(trimmed).hostname.toLowerCase();
      if (
        host.includes("dynacleanindustries.com") ||
        host === "localhost" ||
        host === "127.0.0.1"
      ) {
        const pathname = new URL(trimmed).pathname;
        const token = pathname.replace(/^\/+/, "") || trimmed;
        return `/api/image-proxy?url=${encodeURIComponent(token)}`;
      }
    } catch {
      /* use trimmed below */
    }
    return trimmed;
  }

  return `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
}

/** Same-origin or proxied URL suitable for fetch() (PDF embed, print resolver). */
export async function resolveCompletionImageFetchUrl(filePath) {
  const trimmed = String(filePath || "").trim();
  if (!trimmed) return "";

  if (trimmed.includes("res.cloudinary.com")) {
    return `/api/cloudinary-proxy?url=${encodeURIComponent(trimmed)}`;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const pathParam = completionImageStoragePath(trimmed);
  try {
    const res = await fetch(
      `/api/resolve-attachment?path=${encodeURIComponent(pathParam)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    const url = String(data?.url || "").trim();
    if (url) {
      if (url.includes("res.cloudinary.com")) {
        return `/api/cloudinary-proxy?url=${encodeURIComponent(url)}`;
      }
      return url;
    }
  } catch {
    /* fallback below */
  }

  return getCompletionImageSrc(trimmed);
}

/** Resolved absolute/proxied URL for print preview <img src>. */
export async function resolveCompletionImageDisplayUrl(filePath) {
  const fetchUrl = await resolveCompletionImageFetchUrl(filePath);
  if (!fetchUrl) return "";
  if (fetchUrl.startsWith("/")) {
    if (typeof window !== "undefined") {
      return new URL(fetchUrl, window.location.origin).toString();
    }
    return fetchUrl;
  }
  return fetchUrl;
}
