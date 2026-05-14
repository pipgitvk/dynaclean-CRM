import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v(version)/folder/public_id.extension
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    
    // Find the version (starts with v) and everything after it is the public_id with folder
    const versionIndex = parts.findIndex(p => p.startsWith('v'));
    if (versionIndex === -1 || versionIndex === parts.length - 1) {
      return NextResponse.json(
        { error: "Invalid Cloudinary URL format" },
        { status: 400 }
      );
    }
    
    const publicIdWithFolder = parts.slice(versionIndex + 1).join('/');
    const publicId = publicIdWithFolder.replace(/\.[^/.]+$/, ""); // Remove extension

    // Get resource type from URL (image, video, raw, etc.)
    // Default to 'auto' but try to detect from URL
    let resourceType = "auto";
    if (url.includes("/image/")) resourceType = "image";
    else if (url.includes("/video/")) resourceType = "video";
    else if (url.includes("/raw/")) resourceType = "raw";

    // Fetch the file from Cloudinary using the SDK
    const result = await new Promise((resolve, reject) => {
      cloudinary.api.resource(publicId, 
        { resource_type: resourceType },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    if (!result || !result.secure_url) {
      return NextResponse.json(
        { error: "File not found in Cloudinary" },
        { status: 404 }
      );
    }

    // Fetch the actual file content
    const response = await fetch(result.secure_url);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.status}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    // Return the file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${publicId.split('/').pop()}"`,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err) {
    console.error("[cloudinary-proxy] Error:", err);
    return NextResponse.json(
      { error: "Failed to proxy file from Cloudinary" },
      { status: 500 }
    );
  }
}
