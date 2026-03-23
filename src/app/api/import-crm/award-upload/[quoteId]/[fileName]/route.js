import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import mime from "mime-types";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isImportCrmAdmin(role) {
  return role === "SUPERADMIN";
}

/** Serve files from uploads/import-crm-award/{quoteId}/ — admin only. */
export async function GET(_request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (!isImportCrmAdmin(payload.role)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { quoteId: rawQid, fileName: rawName } = await params;
    const quoteId = String(rawQid ?? "").trim();
    if (!/^\d+$/.test(quoteId)) {
      return new NextResponse("Bad request", { status: 400 });
    }

    let decodedName;
    try {
      decodedName = decodeURIComponent(String(rawName ?? ""));
    } catch {
      return new NextResponse("Bad request", { status: 400 });
    }
    if (
      !decodedName ||
      decodedName.includes("..") ||
      decodedName.includes("/") ||
      decodedName.includes("\\")
    ) {
      return new NextResponse("Bad request", { status: 400 });
    }

    const baseAllowed = path.join(
      process.cwd(),
      "uploads",
      "import-crm-award",
    );
    const quoteDir = path.join(baseAllowed, quoteId);
    const resolved = path.resolve(quoteDir, decodedName);

    if (!resolved.startsWith(quoteDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const buffer = await fs.promises.readFile(resolved);
    const contentType = mime.lookup(resolved) || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("import-crm award-upload GET:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
