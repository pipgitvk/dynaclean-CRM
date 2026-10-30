import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

import { fetchDelhiveryB2bTrack } from "@/lib/delhiveryB2bTrackFetch";

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

    const fetchResult = await fetchDelhiveryB2bTrack(trackingId);
    if (!fetchResult.ok) {
      return NextResponse.json(
        { success: false, error: fetchResult.error, data: fetchResult.data },
        { status: fetchResult.status >= 400 ? fetchResult.status : 502 },
      );
    }

    return NextResponse.json({
      success: true,
      trackingId,
      data: fetchResult.data,
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
