/**
 * GET /api/cron/meta-backfill-tamil
 * Same schedule idea as main Meta cron: fetch Tamil form leads (last N days) and import → KAVYA.
 * Optional: ?secret=CRON_SECRET or Authorization: Bearer CRON_SECRET
 * Date window: TAMIL_CRON_DAYS_BACK (default 7) or env
 */
import { NextResponse } from "next/server";
import { importNewTamilFormLeads } from "@/lib/tamilFormMetaLeads";
import { getTamilCronDateRange } from "@/lib/metaTamilLeadForm";
import { isCronRequestAuthorized } from "@/lib/cronAuth";

export const maxDuration = 300;

export async function GET(request) {
  try {
    if (!(await isCronRequestAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const daysBack = Number(process.env.TAMIL_CRON_DAYS_BACK) || 7;
    const { since, until } = getTamilCronDateRange(daysBack);

    const skipCampaign =
      process.env.TAMIL_CRON_SKIP_CAMPAIGN_RESOLVE === "1" ||
      process.env.TAMIL_CRON_SKIP_CAMPAIGN_RESOLVE === "true";

    const result = await importNewTamilFormLeads({
      since,
      until,
      skipCampaignResolve: skipCampaign,
    });

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
