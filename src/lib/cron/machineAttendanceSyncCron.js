import cron from "node-cron";
import { getDbConnection } from "@/lib/db";
import {
  currentMonthMachineAttendanceRangeIst,
  getLastMachineAttendanceSync,
  syncMachineAttendanceFromEtimeOffice,
} from "@/lib/syncMachineAttendance";

const GLOBAL_KEY = "__machineAttendanceSyncCronStarted__";
const GLOBAL_CRON_JOB_KEY = "__machineAttendanceSyncCronJob__";
const CATCHUP_DEBOUNCE_KEY = "__machineAttendanceSyncCatchupAt__";
const SYNC_IN_FLIGHT_KEY = "__machineAttendanceSyncInFlight__";

const CATCHUP_MIN_AGE_MS = 50 * 60 * 1000;
const CATCHUP_DEBOUNCE_MS = 2 * 60 * 1000;

function parseIstSyncAt(at) {
  if (!at) return null;
  const s = String(at).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Scheduled pull: current month (IST), all employees. */
export async function runMachineAttendanceHourlySync() {
  if (global[SYNC_IN_FLIGHT_KEY]) {
    return { skippedRun: true, fetched: 0, inserted: 0, updated: 0, skipped: 0 };
  }
  global[SYNC_IN_FLIGHT_KEY] = true;
  try {
    return await runMachineAttendanceHourlySyncInner();
  } finally {
    global[SYNC_IN_FLIGHT_KEY] = false;
  }
}

async function runMachineAttendanceHourlySyncInner() {
  const { from, to } = currentMonthMachineAttendanceRangeIst();
  const result = await syncMachineAttendanceFromEtimeOffice({
    from,
    to,
    empCode: "ALL",
    source: "hourly",
    syncedBy: "cron",
  });
  console.log(
    `✅ Machine attendance sync ${from}–${to}: fetched ${result.fetched}, new ${result.inserted}, updated ${result.updated}`
  );
  return result;
}

async function maybeRunCatchUpSync() {
  const lastCatchup = global[CATCHUP_DEBOUNCE_KEY];
  if (lastCatchup && Date.now() - lastCatchup < CATCHUP_DEBOUNCE_MS) {
    return;
  }
  global[CATCHUP_DEBOUNCE_KEY] = Date.now();

  try {
    const conn = await getDbConnection();
    const last = await getLastMachineAttendanceSync(conn);
    const lastDate = parseIstSyncAt(last?.at);
    const ageMs = lastDate ? Date.now() - lastDate.getTime() : Infinity;
    if (ageMs < CATCHUP_MIN_AGE_MS) {
      return;
    }
    console.log(
      `🔄 Machine attendance catch-up sync (last sync ${last?.at || "never"}, source ${last?.source || "—"})`
    );
    await runMachineAttendanceHourlySync();
  } catch (err) {
    console.error("❌ Machine attendance catch-up sync failed:", err);
  }
}

export async function startMachineAttendanceSyncCron() {
  if (global[GLOBAL_CRON_JOB_KEY]) {
    try {
      global[GLOBAL_CRON_JOB_KEY].stop();
    } catch {
      /* ignore */
    }
    global[GLOBAL_CRON_JOB_KEY] = null;
  }

  const cronJob = cron.schedule(
    "0 * * * *",
    () => {
      runMachineAttendanceHourlySync().catch((err) => {
        console.error("❌ Machine attendance sync failed:", err);
      });
    },
    { timezone: "Asia/Kolkata" }
  );

  global[GLOBAL_KEY] = true;
  global[GLOBAL_CRON_JOB_KEY] = cronJob;
  console.log(
    "✅ Machine attendance sync cron scheduled (every hour at :00, Asia/Kolkata)"
  );

  void maybeRunCatchUpSync();
}
