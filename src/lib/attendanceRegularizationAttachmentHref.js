/** Client-safe helper: build a URL that opens attendance regularization attachments. */
export function getAttendanceRegularizationAttachmentHref(
  url,
  requestId = null,
) {
  if (requestId != null && String(requestId).trim() !== "") {
    return `/api/attendance-regularization/attachment?id=${encodeURIComponent(
      String(requestId),
    )}`;
  }

  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return `/api/attendance-regularization/attachment?path=${encodeURIComponent(
      trimmed,
    )}`;
  }

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `/api/attendance-regularization/attachment?path=${encodeURIComponent(
    path,
  )}`;
}
