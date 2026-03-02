export const dynamic = "force-dynamic";

// app first - expense_attachments live in Next.js public folder on app server
const DOMAINS = [
  "https://app.dynacleanindustries.com",
  "https://service.dynacleanindustries.com",
];

async function tryHead(url) {
  try {
    // Try HEAD request first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { 
      method: "HEAD", 
      signal: controller.signal,
      cache: "no-store"
    });
    clearTimeout(timeout);
    console.log(`[tryHead] HEAD ${url} -> ${res.status}`);
    if (res.ok) return true;
    
    // If HEAD failed, try GET with range
    const controllerGet = new AbortController();
    const timeoutGet = setTimeout(() => controllerGet.abort(), 5000);
    const resGet = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: controllerGet.signal,
      cache: "no-store"
    });
    clearTimeout(timeoutGet);
    console.log(`[tryHead] GET ${url} -> ${resGet.status}`);
    return resGet.ok;
  } catch (err) {
    console.log(`[tryHead] Error checking ${url}:`, err.message);
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

  // Allow all incoming root-based paths; previously we restricted with prefixes
  if (!path) {
    return new Response(
      JSON.stringify({ error: "Invalid or missing path" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build all combinations across domains and folder.
  // Clean any public/ prefix and leading slashes for uniform joining
  const cleaned = path.replace(/^\/public\//, "/").replace(/^\/+/, "");

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

  // Try each URL
  console.log('[resolve-attachment] Trying URLs:', uniqueToTry);
  for (const candidate of uniqueToTry) {
    console.log('[resolve-attachment] Checking:', candidate);
    const ok = await tryHead(candidate);
    console.log('[resolve-attachment] Result:', candidate, ok);
    if (ok) {
      console.log('[resolve-attachment] Found working URL:', candidate);
      return new Response(JSON.stringify({ url: candidate, found: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // If all checks failed, return first candidate as fallback with found=false (encoded URL for proper opening)
  console.log('[resolve-attachment] No working URL found, using fallback');
  const fallback =
    uniqueToTry[0] || `${DOMAINS[0]}/${encodePath(cleaned)}`;
  return new Response(JSON.stringify({ url: fallback, found: false }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
