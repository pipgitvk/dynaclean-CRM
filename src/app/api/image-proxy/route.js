import { NextResponse } from "next/server";
import { attachmentStoragePath } from "@/lib/attachmentPathUtils";
import { resolveAttachmentTarget } from "@/lib/resolveAttachmentUrl";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 },
      );
    }

    let finalUrl = String(imageUrl).trim();

    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      const pathParam = attachmentStoragePath(finalUrl) || finalUrl;
      const { url } = await resolveAttachmentTarget(request, pathParam);
      if (url) {
        finalUrl = url;
      } else {
        const storage = attachmentStoragePath(finalUrl);
        finalUrl = `https://service.dynacleanindustries.com/${String(storage).replace(/^\/+/, "")}`;
      }
    }

    if (finalUrl.startsWith("/")) {
      finalUrl = new URL(finalUrl, request.url).toString();
    }

    console.log(`[Image Proxy] Fetching image from: ${finalUrl}`);

    const response = await fetch(finalUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `[Image Proxy] Failed to fetch image: ${response.status} ${response.statusText}`,
      );
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status },
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("[Image Proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to process image", details: error.message },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
