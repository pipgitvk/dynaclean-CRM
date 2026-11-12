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
  if (trimmed.startsWith("http")) return trimmed;

  const storage = completionImageStoragePath(trimmed);
  const path = storage.startsWith("/") ? storage : `/${storage}`;
  return `https://service.dynacleanindustries.com${path}`;
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

  const fallback = getCompletionImageSrc(trimmed);
  if (fallback.includes("res.cloudinary.com")) {
    return `/api/cloudinary-proxy?url=${encodeURIComponent(fallback)}`;
  }
  return `/api/image-proxy?url=${encodeURIComponent(fallback)}`;
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
