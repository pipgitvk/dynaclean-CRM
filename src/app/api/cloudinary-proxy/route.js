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
    
    const version = parts[versionIndex];
    const publicIdWithFolder = parts.slice(versionIndex + 1).join('/');
    
    // Get resource type from URL (image, video, raw, etc.)
    // For PDFs and documents, use "raw"
    let resourceType = "raw";
    if (url.includes("/image/") && !url.endsWith('.pdf')) resourceType = "image";
    else if (url.includes("/video/")) resourceType = "video";
    else if (url.includes("/auto/")) resourceType = "auto";

    // Try multiple approaches to fetch the file
    let response;
    let signedUrl;
    
    // Approach 1: Try signed URL
    try {
      signedUrl = cloudinary.url(publicIdWithFolder, {
        sign_url: true,
        resource_type: resourceType,
        type: 'upload',
        secure: true,
        version: Number(version.slice(1))
      });
      console.log('[cloudinary-proxy] Trying signed URL:', signedUrl);
      response = await fetch(signedUrl);
    } catch (e) {
      console.log('[cloudinary-proxy] Signed URL failed, trying original URL');
    }

    // Approach 2: If signed URL failed, try original URL with fetch flags
    if (!response || !response.ok) {
      console.log('[cloudinary-proxy] Trying original URL with flags');
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
    }

    if (!response.ok && url.includes("/image/upload/") && url.toLowerCase().endsWith(".pdf")) {
      console.log('[cloudinary-proxy] Trying raw URL converted from image PDF URL');
      response = await fetch(url.replace("/image/upload/", "/raw/upload/"), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
    }

    // Approach 3: Try with different resource type if still failing
    if (!response.ok && resourceType === "raw") {
      console.log('[cloudinary-proxy] Trying with image resource type');
      signedUrl = cloudinary.url(publicIdWithFolder, {
        sign_url: true,
        resource_type: "image",
        type: 'upload',
        secure: true,
        version: Number(version.slice(1))
      });
      response = await fetch(signedUrl);
    }

    if (!response.ok) {
      console.error('[cloudinary-proxy] All approaches failed');
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
        "Content-Disposition": `inline; filename="${publicIdWithFolder.split('/').pop()}"`,
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
