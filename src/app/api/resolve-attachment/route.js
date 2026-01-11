export const dynamic = "force-dynamic";

const DOMAINS = [
  "https://service.dynacleanindustries.com",
  "https://app.dynacleanindustries.com",
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

  // Determine trailing after removing known folder prefix (if present)
  let trailing = cleaned;
  if (cleaned.startsWith("completion_files/")) {
    trailing = cleaned.replace(/^completion_files\//, "");
  } else if (cleaned.startsWith("attachments/")) {
    trailing = cleaned.replace(/^attachments\//, "");
  }

  const folders = ["completion_files", "attachments"]; 
  const pathsToTry = [];

  // Try both domains x both folder with the trailing segment
  for (const domain of DOMAINS) {
    for (const folder of folders) {
      pathsToTry.push(`${domain}/${folder}/${trailing}`);
    }
  }

  // Also try the original cleaned as-is on both domains (in case of deeper nesting)
  for (const domain of DOMAINS) {
    pathsToTry.push(`${domain}/${cleaned}`);
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

  // If all checks failed, return first candidate as fallback with found=false
  console.log('[resolve-attachment] No working URL found, using fallback');
  const fallback = uniqueToTry[0] || `${DOMAINS[0]}/${cleaned}`;
  return new Response(JSON.stringify({ url: fallback, found: false }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
