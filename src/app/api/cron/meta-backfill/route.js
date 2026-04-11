/**
 * GET /api/cron/meta-backfill
 * Cron endpoint - call every 10 min to auto-fetch leads from Meta and save to DB
 * Optional: ?secret=YOUR_CRON_SECRET (if CRON_SECRET is set in .env)
 * Dashboard "Test Cron" uses admin session when secret is not sent (see cronAuth).
 */
import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";

export async function GET(request) {
  try {
    if (!(await isCronRequestAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;

    const metaUrl = `${baseUrl.replace(/\/$/, "")}/api/meta-backfill?mode=all&autoImport=1`;
    const res = await fetch(metaUrl);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "Meta backfill failed", details: data },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Cron ran successfully",
      imported: data?.importSummary?.imported ?? 0,
      skipped: data?.importSummary?.skipped ?? 0,
      errors: data?.importSummary?.errors ?? 0,
    });
  } catch (err) {
    console.error("❌ Cron meta-backfill error:", err);
    return NextResponse.json(
      { error: "Cron failed", message: err.message },
      { status: 500 }
    );
  }
}
