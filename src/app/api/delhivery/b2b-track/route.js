import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

const DELHIVERY_B2B_TRACK_BASE =
  "https://btob.api.delhivery.com/v2/track";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trackingId = String(
      req.nextUrl.searchParams.get("trackingId") ||
        req.nextUrl.searchParams.get("tracking_id") ||
        "",
    ).trim();

    if (!trackingId) {
      return NextResponse.json(
        { error: "trackingId is required" },
        { status: 400 },
      );
    }

    const url = `${DELHIVERY_B2B_TRACK_BASE}/${encodeURIComponent(trackingId)}?mwbn=true`;
    const headers = { Accept: "application/json" };
    const token = process.env.DELHIVERY_B2B_API_TOKEN?.trim();
    if (token) {
      headers.Authorization = `Token ${token}`;
    }

    const upstream = await fetch(url, {
      headers,
      cache: "no-store",
    });

    const raw = await upstream.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { raw };
    }

    if (!upstream.ok) {
      const message =
        (data && (data.message || data.error || data.detail)) ||
        `Delhivery API error (${upstream.status})`;
      return NextResponse.json(
        { success: false, error: message, data },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    return NextResponse.json({
      success: true,
      trackingId,
      data,
    });
  } catch (err) {
    console.error("[delhivery/b2b-track]", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to fetch tracking",
      },
      { status: 500 },
    );
  }
}
