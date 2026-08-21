export const BID_DOCUMENT_PARSE_OPTIONS = {
  multiples: true,
  allowedExt: [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"],
  allowedMime: [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

function fileNameFromUrl(url, fallback) {
  const raw = (url || "").split("?")[0].split("/").pop() || fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function toDoc(item, index) {
  if (!item) return null;
  if (typeof item === "string") {
    const url = item.trim();
    if (!url) return null;
    return { url, name: fileNameFromUrl(url, `Document ${index + 1}`) };
  }
  if (typeof item === "object" && item.url) {
    return {
      url: item.url,
      name: item.name || fileNameFromUrl(item.url, `Document ${index + 1}`),
    };
  }
  return null;
}

export function parseBidDocuments(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(toDoc).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(toDoc).filter(Boolean);
      } catch {
        // fall through to legacy single-path handling
      }
    }
    return [toDoc(trimmed, 0)].filter(Boolean);
  }

  return [];
}

export function stringifyBidDocuments(docs) {
  const parsed = parseBidDocuments(docs);
  if (parsed.length === 0) return null;
  return JSON.stringify(parsed);
}

export function normalizeFormidableFiles(fileOrArray) {
  if (!fileOrArray) return [];
  return Array.isArray(fileOrArray) ? fileOrArray.filter(Boolean) : [fileOrArray];
}
