/**
 * Tamil Meta form (1402217014975670): fetch from Graph + import new leads → KAVYA.
 * Shared by /api/meta-backfill/tamil-form-leads and /api/cron/meta-backfill-tamil
 */
import { getDbConnection } from "@/lib/db";
import { normalizePhone, PHONE_LAST10_WHERE } from "@/lib/phone-check";
import {
  extractProductFromMetaFieldData,
  buildProductsInterestLabel,
} from "@/lib/metaLeadProduct";
import { parseLeadFromFieldData, insertLeadIntoDb } from "@/app/api/meta-backfill/route";
import {
  TAMIL_META_FORM_ID,
  TAMIL_META_ASSIGNEE_USERNAME,
} from "@/lib/metaTamilLeadForm";

export async function fetchTamilFormLeadsFromMeta({ since, until, token }) {
  let url = new URL(`https://graph.facebook.com/v18.0/${TAMIL_META_FORM_ID}/leads`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "100");
  url.searchParams.set("fields", "field_data,ad_id,created_time");
  url.searchParams.set("time_range[since]", since);
  url.searchParams.set("time_range[until]", until);

  let rawLeads = [];
  let pageCount = 0;
  const maxPages = 50;
  while (url && pageCount < maxPages) {
    pageCount += 1;
    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      return {
        error: data?.error || data,
        leadsInRange: [],
        rawFetchedCount: 0,
      };
    }

    rawLeads = rawLeads.concat(data?.data || []);
    const next = data?.paging?.next;
    url = next ? new URL(next) : null;
  }

  const mapped = rawLeads.map((lead) => {
    const fieldData = lead.field_data || [];
    return {
      leadgen_id: lead.id,
      created_time: lead.created_time || null,
      ad_id: lead.ad_id || null,
      field_data: fieldData,
      ...parseLeadFromFieldData(fieldData, {
        lead_campaign: "social_media",
        products_interest: "",
      }),
    };
  });

  const sinceDate = new Date(`${since}T00:00:00Z`);
  const untilDate = new Date(`${until}T23:59:59Z`);
  const leadsInRange = mapped.filter((l) => {
    if (!l.created_time) return false;
    const created = new Date(l.created_time);
    return created >= sinceDate && created <= untilDate;
  });

  for (const lead of leadsInRange) {
    const formProduct = extractProductFromMetaFieldData(lead.field_data || []);
    let campaignName = "";
    if (lead.ad_id) {
      try {
        const adRes = await fetch(
          `https://graph.facebook.com/v18.0/${lead.ad_id}?fields=campaign_id&access_token=${token}`,
        );
        const adJson = await adRes.json();
        const campaign_id = adJson?.campaign_id;
        if (campaign_id) {
          const campRes = await fetch(
            `https://graph.facebook.com/v18.0/${campaign_id}?fields=name&access_token=${token}`,
          );
          const campJson = await campRes.json();
          campaignName = campJson?.name || "";
        }
      } catch (err) {
        console.warn("Tamil form: campaign resolve failed", lead.ad_id, err);
      }
    }
    lead.products_interest =
      buildProductsInterestLabel({ formProduct, campaignName }) || formProduct || "";
  }

  return {
    error: null,
    leadsInRange,
    rawFetchedCount: rawLeads.length,
  };
}

/** Normalized last-10 phones that already exist in `customers` (matches insertLeadIntoDb duplicate logic). */
export async function getExistingNormalizedPhonesSet(leadsInRange) {
  const normalizedCandidates = [
    ...new Set(
      leadsInRange
        .map((l) => normalizePhone(l.phone))
        .filter((p) => p && p.length === 10),
    ),
  ];
  const existingLast10 = new Set();
  if (!normalizedCandidates.length) return existingLast10;

  const conn = await getDbConnection();
  const whereOr = normalizedCandidates.map(() => `(${PHONE_LAST10_WHERE})`).join(" OR ");
  const [dupRows] = await conn.execute(
    `SELECT phone FROM customers WHERE ${whereOr}`,
    normalizedCandidates,
  );
  for (const r of dupRows) {
    const n = normalizePhone(r.phone);
    if (n.length === 10) existingLast10.add(n);
  }
  return existingLast10;
}

/** Import leads not yet in DB; all assigned to TAMIL_META_ASSIGNEE_USERNAME */
export async function importNewTamilFormLeads({ since, until }) {
  const token = process.env.FB_PAGE_TOKEN;
  if (!token) {
    return { ok: false, error: "FB_PAGE_TOKEN not configured", status: 500 };
  }

  const { error, leadsInRange } = await fetchTamilFormLeadsFromMeta({
    since,
    until,
    token,
  });

  if (error) {
    return {
      ok: false,
      error: "meta_fetch_failed",
      metaError: error,
      status: 502,
    };
  }

  const existingLast10 = await getExistingNormalizedPhonesSet(leadsInRange);

  const newLeads = leadsInRange.filter((l) => {
    const n = normalizePhone(l.phone);
    if (!n || n.length !== 10) return false;
    return !existingLast10.has(n);
  });

  const results = [];
  for (const lead of newLeads) {
    try {
      const insertResult = await insertLeadIntoDb(lead, {
        forceAssignTo: TAMIL_META_ASSIGNEE_USERNAME,
      });
      results.push({ leadgen_id: lead.leadgen_id, ...insertResult });
    } catch (err) {
      console.error("Tamil form import error", lead.leadgen_id, err);
      results.push({
        leadgen_id: lead.leadgen_id,
        error: err?.message || String(err),
      });
    }
  }

  const importSummary = {
    imported: results.filter((r) => !r.skipped && !r.error).length,
    skipped: results.filter((r) => r.skipped).length,
    errors: results.filter((r) => r.error).length,
    results,
  };

  return {
    ok: true,
    formId: TAMIL_META_FORM_ID,
    assignee: TAMIL_META_ASSIGNEE_USERNAME,
    new_count: newLeads.length,
    importSummary,
  };
}
