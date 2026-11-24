export const dynamic = "force-dynamic";

import {
  normalizeServeAttachmentPathParam,
  readPublicAttachmentFile,
} from "@/lib/serveAttachmentFile";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cleaned = normalizeServeAttachmentPathParam(searchParams.get("path") || "");

    if (!cleaned) {
      return new Response("Bad Request", { status: 400 });
    }

    const result = await readPublicAttachmentFile(cleaned);
    if (!result.ok) {
      if (result.status === 403) {
        console.error("[serve-attachment] ERROR: invalid or unsafe path:", cleaned);
      } else if (result.status === 404) {
        console.warn("[serve-attachment] NOT FOUND:", cleaned);
      }
      return new Response(result.error || "Error", { status: result.status });
    }

    return new Response(result.buffer, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `inline; filename="${result.fileName}"`,
      },
    });
  } catch (err) {
    console.error("[serve-attachment] ERROR:", err?.message || err);
    return new Response("Server Error", { status: 500 });
  }
}
