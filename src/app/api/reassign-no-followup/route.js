import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  fetchReassignFollowupSummary,
  fetchReassignNoFollowupPage,
  fetchReassignNoFollowupRepOptions,
} from "@/lib/bulkLeadReassignHistoryList";

const ALLOWED_ROLES = new Set(["ADMIN", "SUPERADMIN", "DIRECTOR", "SALES", "SALES CUM BACKOFFICE"]);

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.has(String(payload.role || "").toUpperCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const summary = searchParams.get("summary") === "1";
    const list = searchParams.get("list") === "1";
    const reps = searchParams.get("reps") === "1";

    const conn = await getDbConnection();

    if (reps) {
      const repsList = await fetchReassignNoFollowupRepOptions(conn);
      return NextResponse.json({ success: true, reps: repsList });
    }

    const filters = {
      assignedTo: searchParams.get("assigned_to") || undefined,
      assignedFrom: searchParams.get("assigned_from") || undefined,
      search: searchParams.get("search") || undefined,
      followupStatus: searchParams.get("followup_status") || undefined,
    };

    if (summary) {
      const counts = await fetchReassignFollowupSummary(conn, filters);
      return NextResponse.json({
        success: true,
        followed: counts.followed,
        not_followed: counts.not_followed,
        cohort_total: counts.cohort_total,
        reassign_events_total: counts.reassign_events_total ?? null,
        outside_cohort: counts.outside_cohort ?? null,
        total: counts.not_followed,
      });
    }

    if (list) {
      const limit = Number(searchParams.get("limit"));
      const skip = Number(searchParams.get("skip"));
      const counts = await fetchReassignFollowupSummary(conn, {
        assignedTo: filters.assignedTo,
        assignedFrom: filters.assignedFrom,
        search: filters.search,
      });
      const result = await fetchReassignNoFollowupPage(conn, {
        ...filters,
        limit,
        skip,
      });
      return NextResponse.json({
        success: true,
        ...result,
        followed: counts.followed,
        not_followed: counts.not_followed,
        cohort_total: counts.cohort_total,
      });
    }

    return NextResponse.json({ error: "Use summary=1 or list=1" }, { status: 400 });
  } catch (error) {
    console.error("[reassign-no-followup GET]", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}