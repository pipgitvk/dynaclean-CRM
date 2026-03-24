import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public route — files have UUID-prefixed names so they are not guessable.
// This URL is sent to agents via email so must be accessible without a session.
export async function GET(_request, { params }) {
  try {
    const { billingId, fileName } = await params;
    const safeName = path.basename(decodeURIComponent(fileName || ""));
    if (!safeName) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const filePath = path.join(
      process.cwd(), "uploads", "import-crm-billing-payment",
      String(billingId), safeName,
    );
    const buf = await readFile(filePath);
    const ext = safeName.split(".").pop()?.toLowerCase() || "";
    const mime =
      ext === "pdf" ? "application/pdf"
      : ["jpg", "jpeg"].includes(ext) ? "image/jpeg"
      : ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : "application/octet-stream";

    return new Response(buf, {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }
}
