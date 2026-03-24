import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (payload.role !== "SUPERADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { billingId, fileName } = await params;
    const safeName = path.basename(decodeURIComponent(fileName || ""));
    if (!safeName) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const filePath = path.join(
      process.cwd(), "uploads", "import-crm-billing",
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
