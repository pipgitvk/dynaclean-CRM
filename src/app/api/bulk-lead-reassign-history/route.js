import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { backfillBulkLeadReassignHistory, ensureBulkLeadReassignHistoryTable } from "@/lib/bulkLeadReassignHistory";
import {
  countLeadReassignEvents,
  fetchLeadReassignHistoryPage,
  fetchReassignHistoryRepOptions,
  fetchReassignHistoryAssignedByOptions,
  fetchReassignFromCountsForAssignedTo,
  fetchReassignToCountsForAssignedFrom,
} from "@/lib/bulkLeadReassignHistoryList";

const ALLOWED_READ = ["ADMIN", "SUPERADMIN", "DIRECTOR", "SALES", "SALES CUM BACKOFFICE"];
const ALLOWED_BACKFILL = ["ADMIN", "SUPERADMIN"];

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = String(payload.role || "").toUpperCase();
    if (!ALLOWED_READ.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const conn = await getDbConnection();
    await ensureBulkLeadReassignHistoryTable(conn);

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const customerId = searchParams.get("customer_id");
    const assignedTo = searchParams.get("assigned_to");
    const assignedFrom = searchParams.get("assigned_from");
    const assignedBy = searchParams.get("assigned_by");
    const search = searchParams.get("search");
    const reps = searchParams.get("reps") === "1";
    const assignedByReps = searchParams.get("assigned_by_reps") === "1";
    const fromCounts = searchParams.get("from_counts") === "1";
    const toCounts = searchParams.get("to_counts") === "1";
    const summary = searchParams.get("summary") === "1";
    const eventsOnly = searchParams.get("events") === "1" || summary;

    if (reps) {
      const repsList = await fetchReassignHistoryRepOptions(conn);
      return NextResponse.json({ success: true, reps: repsList });
    }

    if (assignedByReps) {
      const assignedByRepsList = await fetchReassignHistoryAssignedByOptions(conn);
      return NextResponse.json({ success: true, assignedByReps: assignedByRepsList });
    }

    if (fromCounts) {
      const toRep = String(assignedTo || "").trim();
      if (!toRep) {
        return NextResponse.json({ success: true, fromCounts: [] });
      }
      const fromCountsRows = await fetchReassignFromCountsForAssignedTo(conn, toRep, {
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        assignedBy: assignedBy || undefined,
      });
      return NextResponse.json({ success: true, fromCounts: fromCountsRows });
    }

    if (toCounts) {
      const fromRep = String(assignedFrom || "").trim();
      if (!fromRep) {
        return NextResponse.json({ success: true, toCounts: [] });
      }
      const toCountsRows = await fetchReassignToCountsForAssignedFrom(conn, fromRep, {
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        assignedBy: assignedBy || undefined,
      });
      return NextResponse.json({ success: true, toCounts: toCountsRows });
    }

    const filters = {
      from: from || undefined,
      to: to || undefined,
      customerId: customerId || undefined,
      assignedTo: assignedTo || undefined,
      assignedFrom: assignedFrom || undefined,
      assignedBy: assignedBy || undefined,
      search: search || undefined,
    };

    if (summary) {
      const total = await countLeadReassignEvents(conn, eventsOnly ? filters : {});
      return NextResponse.json({ success: true, total });
    }

    if (eventsOnly) {
      const limit = Number(searchParams.get("limit"));
      const skip = Number(searchParams.get("skip"));
      const result = await fetchLeadReassignHistoryPage(conn, {
        ...filters,
        limit,
        skip,
      });
      return NextResponse.json({ success: true, ...result });
    }

    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 500);
    const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);

    const { BULK_LEAD_REASSIGN_HISTORY_TABLE } = await import("@/lib/bulkLeadReassignHistory");

    let sql = `SELECT * FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} WHERE 1=1`;
    const params = [];

    if (customerId) {
      sql += ` AND customer_id = ?`;
      params.push(Number(customerId));
    }
    if (assignedTo) {
      sql += ` AND assigned_to = ?`;
      params.push(assignedTo);
    }

    sql += ` ORDER BY customer_id ASC, valid_from ASC LIMIT ? OFFSET ?`;
    params.push(limit, skip);

    const [rows] = await conn.execute(sql, params);

    let countSql = `SELECT COUNT(*) AS total FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} WHERE 1=1`;
    const countParams = [];
    if (customerId) {
      countSql += ` AND customer_id = ?`;
      countParams.push(Number(customerId));
    }
    if (assignedTo) {
      countSql += ` AND assigned_to = ?`;
      countParams.push(assignedTo);
    }
    const [[countRow]] = await conn.execute(countSql, countParams);

    return NextResponse.json({
      success: true,
      total: Number(countRow?.total || 0),
      data: rows,
    });
  } catch (error) {
    console.error("[bulk-lead-reassign-history GET]", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = String(payload.role || "").toUpperCase();
    if (!ALLOWED_BACKFILL.includes(role)) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const resetBackfill = body.resetBackfill !== false;

    const conn = await getDbConnection();
    const result = await backfillBulkLeadReassignHistory(conn, { resetBackfill });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[bulk-lead-reassign-history POST backfill]", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}