/**
 * GET /api/cron/meta-backfill-tamil
 * Same schedule idea as main Meta cron: fetch Tamil form leads (last N days) and import → KAVYA.
 * Optional: ?secret=CRON_SECRET or Authorization: Bearer CRON_SECRET
 * Date window: TAMIL_CRON_DAYS_BACK (default 7) or env
 */
import { NextResponse } from "next/server";
import { importNewTamilFormLeads } from "@/lib/tamilFormMetaLeads";
import { getTamilCronDateRange } from "@/lib/metaTamilLeadForm";

export const maxDuration = 300;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && secret !== cronSecret && bearerToken !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const daysBack = Number(process.env.TAMIL_CRON_DAYS_BACK) || 7;
    const { since, until } = getTamilCronDateRange(daysBack);

    const result = await importNewTamilFormLeads({ since, until });

    if (!result.ok) {
      if (result.error === "FB_PAGE_TOKEN not configured") {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json(
        {
          error: "Tamil form import failed",
          since,
          until,
          details: result.metaError ?? result,
        },
        { status: result.status ?? 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tamil form cron ran successfully",
      since,
      until,
      formId: result.formId,
      assignee: result.assignee,
      imported: result.importSummary?.imported ?? 0,
      skipped: result.importSummary?.skipped ?? 0,
      errors: result.importSummary?.errors ?? 0,
    });
  } catch (err) {
    console.error("❌ Cron meta-backfill-tamil error:", err);
    return NextResponse.json(
      { error: "Cron failed", message: err.message },
      { status: 500 },
    );
  }
}
