/**
 * Tamil Meta lead form (fixed Form ID): list leads from Meta and optionally import → always KAVYA.
 * GET: ?since=&until= (YYYY-MM-DD)
 * POST: { since, until, autoImport: true } — imports only new phones, assigned to KAVYA
 */
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload, getMainSessionPayload } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone-check";
import {
  fetchTamilFormLeadsFromMeta,
  importNewTamilFormLeads,
} from "@/lib/tamilFormMetaLeads";
import {
  TAMIL_META_FORM_ID,
  TAMIL_META_ASSIGNEE_USERNAME,
} from "@/lib/metaTamilLeadForm";

export const maxDuration = 300;

/** Prefer main JWT when impersonating so SUPERADMIN keeps access to Meta tools */
async function assertAdminMetaRole() {
  const main = await getMainSessionPayload();
  const session = await getSessionPayload();
  const role = (main?.role ?? session?.role ?? "").toUpperCase() || "";
  if (!["ADMIN", "SUPERADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }
  return null;
}

export async function GET(request) {
  try {
    const forbidden = await assertAdminMetaRole();
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    const until = searchParams.get("until");

    if (!since || !until) {
      return NextResponse.json(
        { error: "Both since and until (YYYY-MM-DD) are required" },
        { status: 400 },
      );
    }

    const token = process.env.FB_PAGE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "FB_PAGE_TOKEN not configured" }, { status: 500 });
    }

    const { error, leadsInRange, rawFetchedCount } = await fetchTamilFormLeadsFromMeta({
      since,
      until,
      token,
    });

    if (error) {
      return NextResponse.json(
        {
          error: "meta_fetch_failed",
          message: "Failed to fetch leads from Meta",
          metaError: error,
        },
        { status: 502 },
      );
    }

    const phones = leadsInRange.map((l) => l.phone).filter((p) => !!p);
    let existingPhones = new Set();
    if (phones.length) {
      const conn = await getDbConnection();
      const placeholders = phones.map(() => "?").join(",");
      const [rows] = await conn.execute(
        `SELECT phone FROM customers WHERE phone IN (${placeholders})`,
        phones,
      );
      existingPhones = new Set(rows.map((r) => normalizePhone(r.phone)));
    }

    const leads = leadsInRange.map((l) => ({
      leadgen_id: l.leadgen_id,
      created_time: l.created_time,
      first_name: l.first_name,
      phone: l.phone,
      email: l.email,
      address: l.address,
      products_interest: l.products_interest,
      already_in_db: !!(l.phone && existingPhones.has(l.phone)),
    }));

    return NextResponse.json({
      success: true,
      formId: TAMIL_META_FORM_ID,
      assignee: TAMIL_META_ASSIGNEE_USERNAME,
      since,
      until,
      total_from_meta: rawFetchedCount,
      total_in_range: leadsInRange.length,
      leads,
    });
  } catch (err) {
    console.error("/api/meta-backfill/tamil-form-leads GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const forbidden = await assertAdminMetaRole();
    if (forbidden) return forbidden;

    const body = await request.json().catch(() => ({}));
    const since = body.since;
    const until = body.until;
    const autoImport = body.autoImport === true || body.autoImport === "1";

    if (!since || !until) {
      return NextResponse.json(
        { error: "since and until (YYYY-MM-DD) are required" },
        { status: 400 },
      );
    }

    if (!autoImport) {
      return NextResponse.json({ error: "autoImport must be true" }, { status: 400 });
    }

    const result = await importNewTamilFormLeads({ since, until });

    if (!result.ok) {
      if (result.status === 500) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json(
        {
          error: result.error,
          metaError: result.metaError,
        },
        { status: result.status ?? 502 },
      );
    }

    return NextResponse.json({
      success: true,
      formId: result.formId,
      assignee: result.assignee,
      new_count: result.new_count,
      importSummary: result.importSummary,
    });
  } catch (err) {
    console.error("/api/meta-backfill/tamil-form-leads POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
