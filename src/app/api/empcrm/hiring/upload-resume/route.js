import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { canAccessHiringModule } from "@/lib/hrTargetEligibleRoles";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function assertHrRole(payload) {
  if (!payload?.username) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessHiringModule(payload.role ?? payload.userRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function safeExtFromName(name) {
  const m = String(name || "").match(/\.([a-z0-9]{1,8})$/i);
  if (!m) return "";
  let e = `.${m[1].toLowerCase()}`;
  if (e === ".jpeg") e = ".jpg";
  const ok = [".pdf", ".doc", ".docx", ".jpg", ".png", ".webp", ".gif"];
  return ok.includes(e) ? e : "";
}

/** POST multipart/form-data — field name `file` (PDF, Word, or image). Returns public path for selected_resume. */
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    const mime = String(file.type || "").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { success: false, error: "Only PDF, Word (.doc/.docx), or image files are allowed." },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ success: false, error: "Empty file." }, { status: 400 });
    }
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ success: false, error: "File too large (max 8 MB)." }, { status: 400 });
    }

    const extFromMime = EXT_BY_MIME[mime] || "";
    const extFromFile = safeExtFromName(file.name);
    const ext = extFromMime || extFromFile || ".bin";
    const token = randomBytes(12).toString("hex");
    const safeName = `resume-${Date.now()}-${token}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "hiring_resumes");
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, buf);

    const url = `/hiring_resumes/${safeName}`;
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("[empcrm/hiring/upload-resume POST]", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
