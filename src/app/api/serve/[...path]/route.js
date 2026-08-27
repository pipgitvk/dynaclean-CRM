import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

async function findExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/** Recover files when "#" in the filename was stripped by the browser as a URL fragment. */
async function findPathByTruncatedBasename(decodedPath, baseCandidates) {
  const basename = path.basename(decodedPath);
  if (!basename || path.extname(basename)) return null;

  const parentDirs = new Set(
    baseCandidates.map((candidate) => path.dirname(candidate)),
  );

  for (const parentDir of parentDirs) {
    try {
      const entries = await fs.readdir(parentDir);
      const match = entries.find(
        (name) => name.startsWith(basename) && path.extname(name),
      );
      if (match) {
        const resolved = path.join(parentDir, match);
        try {
          await fs.access(resolved);
          return resolved;
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function GET(req, { params }) {
  try {
    const { path: filePath } = await params;
    
    if (!filePath || filePath.length === 0) {
      return NextResponse.json({ error: "File path required" }, { status: 400 });
    }

    // Join the path segments and decode
    const fullPath = filePath.join("/");
    const decodedPath = decodeURIComponent(fullPath);
    
    // Security check: prevent path traversal
    if (decodedPath.includes("..") || decodedPath.startsWith("/")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Construct the file path - check multiple possible locations
    const possiblePaths = [
      path.join(process.cwd(), "uploads", decodedPath),
      path.join(process.cwd(), "public", "uploads", decodedPath),
      path.join(process.cwd(), "public", decodedPath),
    ];

    let targetPath = await findExistingPath(possiblePaths);

    if (!targetPath) {
      targetPath = await findPathByTruncatedBasename(decodedPath, possiblePaths);
    }

    if (!targetPath) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const resolvedBasename = path.basename(targetPath);

    // Read the file
    const fileBuffer = await fs.readFile(targetPath);
    
    // Get file extension to determine content type
    const ext = path.extname(resolvedBasename).toLowerCase();
    let contentType = "application/octet-stream";
    
    switch (ext) {
      case ".pdf":
        contentType = "application/pdf";
        break;
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg";
        break;
      case ".png":
        contentType = "image/png";
        break;
      case ".gif":
        contentType = "image/gif";
        break;
      case ".txt":
        contentType = "text/plain";
        break;
      case ".doc":
        contentType = "application/msword";
        break;
      case ".docx":
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;
      case ".xls":
        contentType = "application/vnd.ms-excel";
        break;
      case ".xlsx":
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
      case ".csv":
        contentType = "text/csv";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
      case ".bmp":
        contentType = "image/bmp";
        break;
      case ".svg":
        contentType = "image/svg+xml";
        break;
      case ".tif":
      case ".tiff":
        contentType = "image/tiff";
        break;
      case ".heic":
      case ".heif":
        contentType = "image/heic";
        break;
      case ".zip":
        contentType = "application/zip";
        break;
      case ".mp4":
        contentType = "video/mp4";
        break;
      case ".webm":
        contentType = "video/webm";
        break;
      case ".ppt":
        contentType = "application/vnd.ms-powerpoint";
        break;
      case ".pptx":
        contentType =
          "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        break;
    }

    // Return the file with appropriate headers
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${resolvedBasename}"`,
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });

  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
