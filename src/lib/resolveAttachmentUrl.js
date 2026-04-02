import { existsSync } from "fs";
import { join } from "path";
import {
  ATTACHMENT_DOMAINS,
  normalizeAttachmentPathParam,
} from "@/lib/attachmentPathUtils";

async function tryHead(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (res.ok) return true;

    const controllerGet = new AbortController();
    const timeoutGet = setTimeout(() => controllerGet.abort(), 5000);
    const resGet = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: controllerGet.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutGet);
    return resGet.ok;
  } catch (err) {
    console.error(
      `[resolveAttachmentUrl][tryHead] ERROR url=${url} err=${err?.message || err}`
    );
    return false;
  }
}

const encodePath = (p) =>
  p
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

/**
 * Resolves where a file is stored (local disk vs app vs service) and returns a URL to open it.
 */
export async function resolveAttachmentTarget(request, pathInput) {
  const path = normalizeAttachmentPathParam(pathInput);

  if (!path) {
    return { url: null, found: false, cleaned: "" };
  }

  const cleaned = path.replace(/^\/public\//, "/").replace(/^\/+/, "");
  const safeForLocal =
    !cleaned.includes("..") &&
    (cleaned.startsWith("attachments/") ||
      cleaned.startsWith("expense_attachments/") ||
      cleaned.startsWith("completion_files/"));

  if (safeForLocal) {
    const localPath = join(process.cwd(), "public", cleaned);
    if (existsSync(localPath)) {
      // Relative URL so the browser keeps the current host:port (avoids 3000 vs 3001 mismatches).
      const serveUrl = `/api/serve-attachment?path=${encodeURIComponent(cleaned)}`;
      return { url: serveUrl, found: true, cleaned };
    }
  }

  let trailing = cleaned;
  if (cleaned.startsWith("completion_files/")) {
    trailing = cleaned.replace(/^completion_files\//, "");
  } else if (cleaned.startsWith("attachments/")) {
    trailing = cleaned.replace(/^attachments\//, "");
  } else if (cleaned.startsWith("expense_attachments/")) {
    trailing = cleaned.replace(/^expense_attachments\//, "");
  }

  const expenseFilename =
    trailing.startsWith("expense_attachments/") ?
      trailing.replace(/^expense_attachments\//, "") :
      null;

  const folders = ["completion_files", "attachments", "expense_attachments"];
  const pathsToTry = [];

  let localOrigin = "";
  try {
    const ref = request.headers.get("referer") || request.headers.get("origin");
    if (ref) localOrigin = new URL(ref).origin;
  } catch {}
  const isLocal =
    localOrigin &&
    (localOrigin.includes("localhost") || localOrigin.includes("127.0.0.1"));
  const domainsToTry = isLocal ? [localOrigin, ...ATTACHMENT_DOMAINS] : ATTACHMENT_DOMAINS;

  if (expenseFilename) {
    for (const domain of domainsToTry) {
      pathsToTry.push(
        `${domain}/expense_attachments/${encodePath(expenseFilename)}`
      );
    }
  }

  for (const domain of domainsToTry) {
    for (const folder of folders) {
      pathsToTry.push(`${domain}/${folder}/${encodePath(trailing)}`);
    }
  }

  for (const domain of domainsToTry) {
    pathsToTry.push(`${domain}/${encodePath(cleaned)}`);
  }

  const seen = new Set();
  const uniqueToTry = pathsToTry.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  for (let i = 0; i < uniqueToTry.length; i++) {
    const candidate = uniqueToTry[i];
    const ok = await tryHead(candidate);
    if (ok) {
      return { url: candidate, found: true, cleaned };
    }
  }

  const fallback =
    uniqueToTry[0] || `${ATTACHMENT_DOMAINS[0]}/${encodePath(cleaned)}`;
  return { url: fallback, found: false, cleaned };
}
