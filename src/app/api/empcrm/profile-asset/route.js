import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getSessionPayload } from "@/lib/auth";

function isEmpcrmProfileViewer(session) {
  if (!session?.role) return false;
  const r = String(session.role).trim();
  return ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].some((a) => a.toLowerCase() === r.toLowerCase());
}

/** path segments under public/ — must start with employee_profiles */
function isSafeRelativePath(segments) {
  if (!segments.length || segments[0] !== "employee_profiles") return false;
  for (const s of segments) {
    if (!s || s.includes("..") || s.includes("/") || s.includes("\\")) return false;
  }
  return true;
}

function canAccess(session, segments) {
  if (!session) return false;
  if (isEmpcrmProfileViewer(session)) return true;
  const ownerSeg = segments[1];
  if (!ownerSeg) return false;
  const owner = decodeURIComponent(ownerSeg).trim().toLowerCase();
  const u = String(session.username || "").trim().toLowerCase();
  return u && owner === u;
}

const mimeMap = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let raw = searchParams.get("path") || "";
    raw = raw.trim().replace(/^\/+/, "");
    if (!raw) {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const segments = [];
    for (const s of raw.split("/").filter(Boolean)) {
      try {
        segments.push(decodeURIComponent(s));
      } catch {
        segments.push(s);
      }
    }
    if (!isSafeRelativePath(segments)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!canAccess(session, segments)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const fullPath = join(process.cwd(), "public", ...segments);
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = await readFile(fullPath);
    const ext = segments[segments.length - 1].split(".").pop()?.toLowerCase() || "";
    const contentType = mimeMap[ext] || "application/octet-stream";
    const filename = segments[segments.length - 1];

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[profile-asset]", e?.message || e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
