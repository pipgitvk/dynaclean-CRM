import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Only allow Cloudinary URLs
    if (!url.includes("res.cloudinary.com")) {
      return NextResponse.json({ error: "Only Cloudinary URLs are allowed" }, { status: 400 });
    }

    // Decode the URL in case it's double-encoded
    const decodedUrl = decodeURIComponent(url);

    // Try fetching the file directly from Cloudinary
    // Cloudinary public files don't need auth — 401 usually means wrong resource_type in URL
    // Try the original URL first, then swap resource type if needed
    const urlsToTry = [decodedUrl];

    // If it's a PDF served under /image/upload/, also try /raw/upload/
    if (decodedUrl.includes("/image/upload/") && decodedUrl.toLowerCase().endsWith(".pdf")) {
      urlsToTry.push(decodedUrl.replace("/image/upload/", "/raw/upload/"));
    }
    // If it's under /raw/upload/, also try /image/upload/
    if (decodedUrl.includes("/raw/upload/")) {
      urlsToTry.push(decodedUrl.replace("/raw/upload/", "/image/upload/"));
    }

    let response = null;
    for (const tryUrl of urlsToTry) {
      try {
        response = await fetch(tryUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DynacleanCRM/1.0)",
          },
        });
        if (response.ok) break;
        console.log(`[cloudinary-proxy] ${tryUrl} → ${response.status}`);
      } catch (err) {
        console.log(`[cloudinary-proxy] fetch failed for ${tryUrl}:`, err.message);
      }
    }

    if (!response || !response.ok) {
      const status = response?.status || 502;
      console.error(`[cloudinary-proxy] All URLs failed. Last status: ${status}`);
      return NextResponse.json(
        { error: `Failed to fetch file: ${status}` },
        { status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type
    let contentType = response.headers.get("content-type") || "application/octet-stream";
    const lower = decodedUrl.toLowerCase();
    if (lower.endsWith(".pdf")) contentType = "application/pdf";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (lower.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".gif")) contentType = "image/gif";
    else if (lower.endsWith(".webp")) contentType = "image/webp";

    // Extract filename from URL
    const filename = decodedUrl.split("/").pop().split("?")[0] || "file";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[cloudinary-proxy] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
