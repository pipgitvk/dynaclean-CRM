/**
 * GET /api/cron/machine-attendance-sync
 * Machine punch sync hourly (eTimeOffice → DB). Vercel cron or ?secret=CRON_SECRET.
 */
import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runMachineAttendanceHourlySync } from "@/lib/cron/machineAttendanceSyncCron";

export async function GET(request) {
  try {
    if (!(await isCronRequestAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runMachineAttendanceHourlySync();
    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      lastSync: result.lastSync,
      range: result.range,
    });
  } catch (err) {
    console.error("❌ Cron machine-attendance-sync error:", err);
    return NextResponse.json(
      { error: "Sync failed", message: err.message },
      { status: 500 }
    );
  }
}
