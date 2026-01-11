import { NextResponse } from "next/server";

// Proxy signature images from service.dynacleanindustries.com and return as data URLs
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { error: "Missing filename" },
        { status: 400 }
      );
    }

    const remoteUrl = `https://service.dynacleanindustries.com/signatures/${encodeURIComponent(
      filename
    )}`;

    const response = await fetch(remoteUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream responded with ${response.status}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/png";
    const base64 = buffer.toString("base64");

    return NextResponse.json({
      dataUrl: `data:${contentType};base64,${base64}`,
    });
  } catch (err) {
    console.error("[signature-proxy] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch signature" },
      { status: 500 }
    );
  }
}
