export const dynamic = "force-dynamic";

import { normalizeAttachmentPathParam } from "@/lib/attachmentPathUtils";
import { resolveAttachmentTarget } from "@/lib/resolveAttachmentUrl";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let path = searchParams.get("path") || "";
  path = normalizeAttachmentPathParam(path);

  if (!path) {
    console.error("[resolve-attachment] ERROR: missing or invalid path");
    return new Response(
      JSON.stringify({ error: "Invalid or missing path" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[resolve-attachment] REQUEST path="${path}"`);

  const { url, found } = await resolveAttachmentTarget(request, path);
  return new Response(JSON.stringify({ url, found }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
