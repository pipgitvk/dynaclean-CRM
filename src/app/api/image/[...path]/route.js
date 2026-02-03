import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import mime from "mime-types";

export async function GET(req, { params }) {
  try {
    const baseDir = path.join(process.cwd(), "uploads");
    const resolvedParams = await params;
    const parts = resolvedParams.path || [];

    const fileName = parts.pop();
    const subfolder = parts.join("/");

    const resolvedPath = path.resolve(baseDir, subfolder, fileName);

    // 🔐 Security check
    if (!resolvedPath.startsWith(baseDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    let filePath = resolvedPath;

    if (!fs.existsSync(filePath)) {
      filePath = path.join(baseDir, "banner.webp");
    }

    const mimeType = mime.lookup(filePath) || "application/octet-stream";

    const { searchParams } = new URL(req.url);
    const width = searchParams.get("w");
    const quality = searchParams.get("q") || 75;

    // Image transform
    if (mimeType.startsWith("image/") && (width || quality)) {
      let image = sharp(filePath);

      if (width) image.resize({ width: Number(width) });

      const buffer = await image.webp({ quality: Number(quality) }).toBuffer();

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const buffer = await fs.promises.readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error(err);
    return new NextResponse("Image error", { status: 500 });
  }
}