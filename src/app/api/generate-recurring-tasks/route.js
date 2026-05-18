import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { manualGenerateRecurringTasks } from "@/lib/cron/recurringTaskCron";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await manualGenerateRecurringTasks();

    return NextResponse.json({ success: true, message: "Recurring task generation triggered" });
  } catch (error) {
    console.error("Error triggering recurring tasks:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
