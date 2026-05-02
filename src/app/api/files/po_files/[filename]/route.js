import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(req, { params }) {
  try {
    const { filename } = await params;
    
    if (!filename) {
      return NextResponse.json({ error: "File path required" }, { status: 400 });
    }

    // Decode the filename to handle URL encoding
    const decodedFilename = decodeURIComponent(filename);
    
    // Security check: prevent path traversal
    if (decodedFilename.includes("..") || decodedFilename.includes("/") || decodedFilename.includes("\\")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    // Construct the file path - check multiple possible locations
    const possiblePaths = [
      path.join(process.cwd(), "uploads", "po_files", decodedFilename),
      path.join(process.cwd(), "public", "uploads", "po_files", decodedFilename),
      path.join(process.cwd(), "public", decodedFilename),
    ];

    let filePath = null;
    let fileExists = false;

    // Check each possible path
    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath);
        filePath = possiblePath;
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
    const fileBuffer = await fs.readFile(filePath);
    
    // Get file extension to determine content type
    const ext = path.extname(decodedFilename).toLowerCase();
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
    }

    // Return the file with appropriate headers
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${decodedFilename}"`,
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });

  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
