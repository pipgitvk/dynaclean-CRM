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

function proxyExternalUrlForClientFetch(trimmed, resolvedUrl) {
  if (resolvedUrl?.startsWith("/")) return resolvedUrl;
  const raw = String(resolvedUrl || trimmed || "").trim();
  if (!raw) return "";
  if (raw.includes("res.cloudinary.com")) {
    return `/api/cloudinary-proxy?url=${encodeURIComponent(raw)}`;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const pathname = new URL(raw).pathname.replace(/^\/+/, "");
      if (pathname) {
        return `/api/image-proxy?url=${encodeURIComponent(pathname)}`;
      }
    } catch {
      /* use raw token below */
    }
    return `/api/image-proxy?url=${encodeURIComponent(raw)}`;
  }
  return getCompletionImageSrc(trimmed);
}

/** Same-origin or proxied URL suitable for fetch() (PDF embed, print resolver). */
export async function resolveCompletionImageFetchUrl(filePath) {
  const trimmed = String(filePath || "").trim();
  if (!trimmed) return "";

  if (trimmed.includes("res.cloudinary.com")) {
    return `/api/cloudinary-proxy?url=${encodeURIComponent(trimmed)}`;
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const pathParam = completionImageStoragePath(trimmed);
    try {
      const res = await fetch(
        `/api/resolve-attachment?path=${encodeURIComponent(pathParam)}`,
        { cache: "no-store", credentials: "include" },
      );
      const data = await res.json();
      const url = String(data?.url || "").trim();
      if (url) {
        return proxyExternalUrlForClientFetch(trimmed, url);
      }
    } catch {
      /* fallback below */
    }
  }

  return proxyExternalUrlForClientFetch(trimmed, getCompletionImageSrc(trimmed));
}

/** Resolved absolute/proxied URL for <img src> (print / on-screen). */
export function resolveCompletionImageDisplayUrlSync(filePath) {
  const src = getCompletionImageSrc(filePath);
  if (!src) return "";
  if (typeof window !== "undefined" && src.startsWith("/")) {
    return new URL(src, window.location.origin).toString();
  }
  return src;
}

/** @deprecated Prefer resolveCompletionImageDisplayUrlSync — kept for callers that await */
export async function resolveCompletionImageDisplayUrl(filePath) {
  const fetchUrl = await resolveCompletionImageFetchUrl(filePath);
  if (!fetchUrl) return resolveCompletionImageDisplayUrlSync(filePath);
  if (fetchUrl.startsWith("/")) {
    if (typeof window !== "undefined") {
      return new URL(fetchUrl, window.location.origin).toString();
    }
    return fetchUrl;
  }
  return fetchUrl;
}
