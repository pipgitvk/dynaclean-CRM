export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { normalizeAttachmentPathParam } from "@/lib/attachmentPathUtils";
import { resolveAttachmentTarget } from "@/lib/resolveAttachmentUrl";

/**
 * HTTP redirect to the resolved file URL — use as href so middle-click, copy-link,
 * and new-tab open work without client-side fetch (fixes mixed app/service uploads).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let path = searchParams.get("path") || "";
  path = normalizeAttachmentPathParam(path);

  if (!path) {
    return NextResponse.json({ error: "Invalid or missing path" }, { status: 400 });
  }

  const { url } = await resolveAttachmentTarget(request, path);
  if (!url) {
    return NextResponse.json({ error: "Could not resolve path" }, { status: 404 });
  }

  return NextResponse.redirect(url, 302);
}
