import cron from "node-cron";
import { applyAutomaticCheckouts } from "@/lib/attendanceAutoCheckout";

const GLOBAL_KEY = "__attendanceAutoCheckoutCronStarted__";
const GLOBAL_CRON_JOB_KEY = "__attendanceAutoCheckoutCronJob__";

export async function startAttendanceAutoCheckoutCron() {
  if (global[GLOBAL_KEY]) {
    return;
  }

  if (global[GLOBAL_CRON_JOB_KEY]) {
    global[GLOBAL_CRON_JOB_KEY].stop();
  }

  const cronJob = cron.schedule("* * * * *", async () => {
    try {
      const updated = await applyAutomaticCheckouts();
      if (updated > 0) {
        console.log(`✅ Auto checkout applied for ${updated} attendance row(s)`);
      }
    } catch (err) {
      console.error("❌ Attendance auto-checkout cron failed:", err);
    }
  });

  global[GLOBAL_KEY] = true;
  global[GLOBAL_CRON_JOB_KEY] = cronJob;
  console.log(
    "✅ Attendance auto-checkout cron scheduled (9:00 PM IST check-out only)"
  );
}
