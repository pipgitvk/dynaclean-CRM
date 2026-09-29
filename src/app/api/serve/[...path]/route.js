import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

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

    let targetPath = null;
    let fileExists = false;

    // Check each possible path
    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath);
        targetPath = possiblePath;
        fileExists = true;
        break;
      } catch {
        // File doesn't exist at this path, continue checking
        continue;
      }
    }

    if (!fileExists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read the file
    const fileBuffer = await fs.readFile(targetPath);
    
    // Get file extension to determine content type
    const ext = path.extname(decodedPath).toLowerCase();
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
        "Content-Disposition": `inline; filename="${path.basename(decodedPath)}"`,
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });

  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
