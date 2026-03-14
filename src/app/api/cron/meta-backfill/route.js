/**
 * GET /api/cron/meta-backfill
 * Cron endpoint - har 10 min par call karo to Meta se leads auto-fetch + DB me save
 * Optional: ?secret=YOUR_CRON_SECRET (agar .env me CRON_SECRET set hai)
 */
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cronSecret = process.env.CRON_SECRET;

    // Accept: ?secret=xxx (cron-job.org, Hostinger) OR Authorization: Bearer xxx (Vercel Cron)
    if (cronSecret && secret !== cronSecret && bearerToken !== cronSecret) {
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
