import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  buildAdminPatSummary,
  fetchPatDrillRows,
  getPatPeriodFromQuery,
} from "@/lib/adminPatSummary";

const PRIVILEGED = new Set(["ADMIN", "SUPERADMIN"]);

export async function GET(req) {
  try {
    const session = await getSessionPayload();
    if (!session || !PRIVILEGED.has(String(session.role || "").toUpperCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = getPatPeriodFromQuery(searchParams);
    const section = String(searchParams.get("section") ?? "").trim();

    const conn = await getDbConnection();

    if (section) {
      const drill = await fetchPatDrillRows(
        conn,
        section,
        period.dateFrom,
        period.dateTo,
      );
      if (drill && typeof drill === "object" && drill.byMonth) {
        return NextResponse.json({ success: true, expenseByMonth: drill, ...period });
      }
      const rows = Array.isArray(drill) ? drill : [];
      return NextResponse.json({ success: true, rows, ...period });
    }

    const summary = await buildAdminPatSummary(conn, period);
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    console.error("pat-summary:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to load PAT summary" },
      { status: 500 },
    );
  }
}
