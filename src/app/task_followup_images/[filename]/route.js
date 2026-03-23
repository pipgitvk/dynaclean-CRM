import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import mime from "mime-types";

/**
 * Legacy URLs stored as /task_followup_images/<file>.
 * Serves from uploads/task_followup (new) or public/task_followup_images (old) if present.
 */
export async function GET(req, { params }) {
  const { filename } = await params;
  if (
    !filename ||
    typeof filename !== "string" ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const roots = [
    path.join(process.cwd(), "uploads", "task_followup"),
    path.join(process.cwd(), "public", "task_followup_images"),
  ];

  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    const filePath = path.resolve(resolvedRoot, filename);
    if (!filePath.startsWith(resolvedRoot) || !fs.existsSync(filePath)) {
      continue;
    }
    const buffer = await fs.promises.readFile(filePath);
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  return new NextResponse("Not found", { status: 404 });
}
