import { NextResponse } from "next/server";
import { ATTACHMENT_DOMAINS, attachmentStoragePath } from "@/lib/attachmentPathUtils";
import { resolveAttachmentTarget } from "@/lib/resolveAttachmentUrl";
import { fetchWithTlsFallback } from "@/lib/fetchWithTlsFallback";
import {
  normalizeServeAttachmentPathParam,
  readPublicAttachmentFile,
} from "@/lib/serveAttachmentFile";

const PROXY_RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=3600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function attachmentFallbackOrigin() {
  const fromEnv = String(process.env.ATTACHMENT_FALLBACK_ORIGIN || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const service = ATTACHMENT_DOMAINS.find((d) => d.includes("service."));
  return (service || ATTACHMENT_DOMAINS[0] || "https://service.dynacleanindustries.com").replace(
    /\/+$/,
    "",
  );
}

async function respondWithLocalAttachment(cleaned) {
  const result = await readPublicAttachmentFile(cleaned);
  if (!result.ok) return null;
  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      ...PROXY_RESPONSE_HEADERS,
      "Content-Type": result.contentType,
    },
  });
}

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
      const cleanedLocal = normalizeServeAttachmentPathParam(pathParam);
      const localRes = cleanedLocal ? await respondWithLocalAttachment(cleanedLocal) : null;
      if (localRes) return localRes;

      const { url } = await resolveAttachmentTarget(request, pathParam);
      if (url) {
        finalUrl = url;
      } else {
        const storage = attachmentStoragePath(finalUrl) || finalUrl;
        const rel = String(storage).replace(/^\/+/, "");
        finalUrl = `${attachmentFallbackOrigin()}/${rel}`;
      }
    }

    if (finalUrl.startsWith("/api/serve-attachment")) {
      try {
        const path = new URL(finalUrl, request.url).searchParams.get("path") || "";
        const cleaned = normalizeServeAttachmentPathParam(path);
        const localRes = cleaned ? await respondWithLocalAttachment(cleaned) : null;
        if (localRes) return localRes;
      } catch {
        /* fall through to fetch */
      }
    }

    if (finalUrl.startsWith("/")) {
      finalUrl = new URL(finalUrl, request.url).toString();
    }

    console.log(`[Image Proxy] Fetching image from: ${finalUrl}`);

    const response = await fetchWithTlsFallback(finalUrl, {
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
        ...PROXY_RESPONSE_HEADERS,
        "Content-Type": contentType,
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