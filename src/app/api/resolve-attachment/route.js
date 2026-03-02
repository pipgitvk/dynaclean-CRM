export const dynamic = "force-dynamic";

import { existsSync } from "fs";
import { join } from "path";

// app first - expense_attachments live in Next.js public folder on app server
const DOMAINS = [
  "https://app.dynacleanindustries.com",
  "https://service.dynacleanindustries.com",
];

function getRequestOrigin(request) {
  try {
    const ref = request.headers.get("referer") || request.headers.get("origin");
    if (ref) return new URL(ref).origin;
  } catch {}
  return DOMAINS[0];
}

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
    console.log(`[resolve-attachment][tryHead] HEAD ${url} -> ${res.status}`);
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
    console.log(`[resolve-attachment][tryHead] GET ${url} -> ${resGet.status}`);
    return resGet.ok;
  } catch (err) {
    console.error(
      `[resolve-attachment][tryHead] ERROR url=${url} err=${err?.message || err}`
    );
    return false;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let path = searchParams.get("path") || "";

  // Normalize input path
  try {
    if (path.startsWith("http")) {
      const u = new URL(path);
      path = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    }
  } catch { }
  if (path && !path.startsWith("/")) path = `/${path}`;

  if (!path) {
    console.error("[resolve-attachment] ERROR: missing or invalid path");
    return new Response(
      JSON.stringify({ error: "Invalid or missing path" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[resolve-attachment] REQUEST path="${path}"`);

  const cleaned = path.replace(/^\/public\//, "/").replace(/^\/+/, "");
  const safeForLocal =
    !cleaned.includes("..") &&
    (cleaned.startsWith("attachments/") ||
      cleaned.startsWith("expense_attachments/") ||
      cleaned.startsWith("completion_files/"));

  // STEP 1: Check if file exists locally (public/attachments, expense_attachments, completion_files)
  // Fixes 404 when file is on same server but nginx/external URL doesn't serve static files
  if (safeForLocal) {
    const localPath = join(process.cwd(), "public", cleaned);
    if (existsSync(localPath)) {
      const origin = getRequestOrigin(request);
      const serveUrl = `${origin}/api/serve-attachment?path=${encodeURIComponent(cleaned)}`;
      console.log(`[resolve-attachment] LOCAL FOUND: ${localPath} -> ${serveUrl}`);
      return new Response(JSON.stringify({ url: serveUrl, found: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Build all combinations across domains and folder.

  // Encode path segments so spaces/special chars in filenames work (e.g. "Best Walk Behind.csv" -> "Best%20Walk%20Behind.csv")
  const encodePath = (p) =>
    p
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");

  // Determine trailing after removing known folder prefix (if present)
  let trailing = cleaned;
  if (cleaned.startsWith("completion_files/")) {
    trailing = cleaned.replace(/^completion_files\//, "");
  } else if (cleaned.startsWith("attachments/")) {
    trailing = cleaned.replace(/^attachments\//, "");
  } else if (cleaned.startsWith("expense_attachments/")) {
    trailing = cleaned.replace(/^expense_attachments\//, "");
  }

  // If path is completion_files/expense_attachments/file or attachments/expense_attachments/file,
  // the actual file lives at expense_attachments/file on app server - extract for correct lookup
  const expenseFilename =
    trailing.startsWith("expense_attachments/") ?
      trailing.replace(/^expense_attachments\//, "") : null;

  const folders = ["completion_files", "attachments", "expense_attachments"];
  const pathsToTry = [];

  // In dev, try request origin first (localhost) so local public/ files work
  let localOrigin = "";
  try {
    const ref = request.headers.get("referer") || request.headers.get("origin");
    if (ref) localOrigin = new URL(ref).origin;
  } catch {}
  const isLocal =
    localOrigin &&
    (localOrigin.includes("localhost") || localOrigin.includes("127.0.0.1"));
  const domainsToTry = isLocal ? [localOrigin, ...DOMAINS] : DOMAINS;
  console.log(
    `[resolve-attachment] parsed cleaned="${cleaned}" trailing="${trailing}" expenseFilename=${expenseFilename ?? "null"} isLocal=${isLocal} domains=${domainsToTry.join(",")}`
  );

  // When path is completion_files/expense_attachments/file, try expense_attachments/file FIRST
  // (expense files live there on app server, not under completion_files)
  if (expenseFilename) {
    for (const domain of domainsToTry) {
      pathsToTry.push(
        `${domain}/expense_attachments/${encodePath(expenseFilename)}`
      );
    }
  }

  // Try all domains x all folders with the trailing segment (properly encoded)
  for (const domain of domainsToTry) {
    for (const folder of folders) {
      pathsToTry.push(`${domain}/${folder}/${encodePath(trailing)}`);
    }
  }

  // Also try the original cleaned as-is on all domains (encoded, in case of deeper nesting)
  for (const domain of domainsToTry) {
    pathsToTry.push(`${domain}/${encodePath(cleaned)}`);
  }

  // Deduplicate while preserving order
  const seen = new Set();
  const uniqueToTry = pathsToTry.filter(u => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  console.log(
    `[resolve-attachment] Trying ${uniqueToTry.length} URLs:`,
    uniqueToTry
  );
  for (let i = 0; i < uniqueToTry.length; i++) {
    const candidate = uniqueToTry[i];
    console.log(`[resolve-attachment] [${i + 1}/${uniqueToTry.length}] Checking:`, candidate);
    const ok = await tryHead(candidate);
    console.log(`[resolve-attachment] [${i + 1}/${uniqueToTry.length}] Result: ${ok ? "FOUND" : "404"}`);
    if (ok) {
      console.log(`[resolve-attachment] SUCCESS returning url=${candidate}`);
      return new Response(JSON.stringify({ url: candidate, found: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  console.error(
    `[resolve-attachment] FAILED all ${uniqueToTry.length} URLs returned 404 - file may not exist on server. Fallback:`,
    uniqueToTry[0]
  );
  const fallback =
    uniqueToTry[0] || `${DOMAINS[0]}/${encodePath(cleaned)}`;
  return new Response(JSON.stringify({ url: fallback, found: false }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
