export const parseCompletionImageList = (value) =>
  value
    ? String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

export function getCompletionImageSrc(filePath) {
  if (!filePath) return "";
  const trimmed = String(filePath).trim();
  if (trimmed.includes("res.cloudinary.com")) {
    return `/api/cloudinary-proxy?url=${encodeURIComponent(trimmed)}`;
  }
  if (trimmed.startsWith("http")) return trimmed;

  let path = trimmed;
  if (path.startsWith("http")) {
    try {
      path = new URL(path).pathname;
    } catch {
      // keep original path
    }
  }
  path = path.replace(/^\/public\//, "/").replace(/^public\//, "");
  if (!path.startsWith("/")) path = `/${path}`;
  if (!path.includes("/completion_files/") && !path.includes("/attachments/")) {
    const cleanPath = path.replace(/^\/+/, "");
    path = `/completion_files/${cleanPath}`;
  }
  return path.startsWith("http")
    ? path
    : `https://service.dynacleanindustries.com${path}`;
}
