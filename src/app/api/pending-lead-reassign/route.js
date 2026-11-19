import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  PENDING_REASSIGN_REP_JOIN,
  PENDING_REASSIGN_WHERE_CORE,
  pendingReassignCampaignFilterSql,
  pendingReassignSearchSql,
  pendingReassignStatusValues,
} from "@/lib/pendingLeadReassignQueries";

const ALLOWED_ROLES = new Set(["ADMIN", "SUPERADMIN", "SALES", "SALES CUM BACKOFFICE"]);

function parseLimit(raw, fallback = 50) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(150, Math.floor(n));
}

function parseSkip(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

// GET — summary count or paginated list of sales leads on inactive reps
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.has(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const summary = searchParams.get("summary") === "1";
    const list = searchParams.get("list") === "1";
    const search = searchParams.get("search") || "";
    const leadSource = String(searchParams.get("lead_source") || "").trim();
    const stage = String(searchParams.get("stage") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const leadCampaign = String(searchParams.get("lead_campaign") || "").trim();
    const repsOnly = searchParams.get("reps") === "1";

    const connection = await getDbConnection();

    if (repsOnly) {
      const [rows] = await connection.execute(
        `SELECT DISTINCT TRIM(c.lead_source) AS username
         FROM customers c
         ${PENDING_REASSIGN_REP_JOIN}
         WHERE ${PENDING_REASSIGN_WHERE_CORE}
         ORDER BY username ASC`,
      );
      return NextResponse.json({
        success: true,
        reps: rows.map((r) => r.username).filter(Boolean),
      });
    }

    let extraWhere = "";
    const extraParams = [];

    if (leadSource) {
      extraWhere += ` AND TRIM(c.lead_source) = ?`;
      extraParams.push(leadSource);
    }

    if (stage) {
      extraWhere += ` AND TRIM(COALESCE(c.stage, '')) = ?`;
      extraParams.push(stage);
    }

    const statusVariants = pendingReassignStatusValues(status);
    if (statusVariants?.length) {
      extraWhere += ` AND c.status IN (${statusVariants.map(() => "?").join(", ")})`;
      extraParams.push(...statusVariants);
    }

    if (leadCampaign) {
      const campaignSql = pendingReassignCampaignFilterSql(leadCampaign);
      if (campaignSql) {
        extraWhere += ` AND ${campaignSql}`;
      } else {
        extraWhere += ` AND c.lead_campaign = ?`;
        extraParams.push(leadCampaign);
      }
    }

    const { clause: searchClause, params: searchParams_ } = pendingReassignSearchSql(search);
    extraWhere += searchClause;
    extraParams.push(...searchParams_);

    const fromClause = `FROM customers c ${PENDING_REASSIGN_REP_JOIN}`;
    const whereClause = `WHERE ${PENDING_REASSIGN_WHERE_CORE}${extraWhere}`;

    if (summary) {
      const [[row]] = await connection.execute(
        `SELECT COUNT(*) AS cnt ${fromClause} ${whereClause}`,
        extraParams,
      );
      return NextResponse.json({
        success: true,
        total: Number(row?.cnt || 0),
      });
    }

    if (list) {
      const limit = parseLimit(searchParams.get("limit"));
      const skip = parseSkip(searchParams.get("skip"));

      const [[countRow]] = await connection.execute(
        `SELECT COUNT(*) AS cnt ${fromClause} ${whereClause}`,
        extraParams,
      );
      const total = Number(countRow?.cnt || 0);

      const [rows] = await connection.execute(
        `SELECT
           c.customer_id,
           c.first_name,
           c.last_name,
           c.email,
           c.phone,
           c.company,
           c.status,
           c.stage,
           c.tags,
           TRIM(c.lead_source) AS lead_source,
           c.lead_campaign,
           c.products_interest,
           c.date_created,
           r.status AS rep_status,
           (
             SELECT MAX(cf.time_stamp)
             FROM customers_followup cf
             WHERE cf.customer_id = c.customer_id
               AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(c.lead_source)
               AND cf.time_stamp > '1999-12-31'
           ) AS last_followup_at,
           (
             SELECT cf.notes
             FROM customers_followup cf
             WHERE cf.customer_id = c.customer_id
               AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(c.lead_source)
               AND cf.time_stamp > '1999-12-31'
             ORDER BY cf.time_stamp DESC
             LIMIT 1
           ) AS last_followup_notes
         ${fromClause}
         ${whereClause}
         ORDER BY c.date_created DESC
         LIMIT ? OFFSET ?`,
        [...extraParams, limit, skip],
      );

      return NextResponse.json({
        success: true,
        data: rows,
        total,
      });
    }

    return NextResponse.json({ error: "Use summary=1 or list=1" }, { status: 400 });
  } catch (error) {
    console.error("[pending-lead-reassign GET]", error);
    return NextResponse.json({ error: "Failed to fetch pending leads" }, { status: 500 });
  }
}