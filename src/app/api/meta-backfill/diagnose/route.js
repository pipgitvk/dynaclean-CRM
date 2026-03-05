/**
 * GET /api/meta-backfill/diagnose
         * Diagnose Meta/Facebook Lead Ads API configuration + DB setup
 * Helps identify: wrong form ID, token permissions, lead_distribution, webhook, why leads not in DB
 */
import { getDbConnection } from "@/lib/db";

function normalizePhone(phone) {
  if (!phone) return null;
  let p = typeof phone === "string" ? phone : String(phone);
  p = p.replace(/\D/g, "");
  if (p.startsWith("91") && p.length > 10) p = p.slice(-10);
  if (p.length > 10) p = p.slice(-10);
  return p || null;
}

export async function GET() {
  const token = process.env.FB_PAGE_TOKEN;
  const formId = process.env.FB_LEAD_FORM_ID;
  const pageId = process.env.FB_PAGE_ID;
  const adAccountId = process.env.FB_AD_ACCOUNT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const result = {
    configured: { token: !!token, formId: !!formId, pageId: !!pageId, adAccountId: !!adAccountId },
    formId: formId || null,
    pageId: pageId || null,
    webhookUrl: `${baseUrl.replace(/\/$/, "")}/api/webhook`,
    checks: [],
    suggestions: [],
    dbDiagnosis: null,
    metaVsDb: null,
  };

  if (!token) {
    result.checks.push({ name: "Token", status: "missing", message: "FB_PAGE_TOKEN not set in .env" });
    return Response.json(result);
  }

  try {
    // 1. Debug token - check validity and permissions (uses same token; app token would be better)
    let tokenInfo = null;
    try {
      const debugRes = await fetch(
        `https://graph.facebook.com/v18.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
      );
      const debugData = await debugRes.json();
      tokenInfo = debugData?.data;

      if (tokenInfo) {
        result.checks.push({
          name: "Token Valid",
          status: tokenInfo?.is_valid ? "ok" : "error",
          message: tokenInfo?.is_valid ? "Token is valid" : (tokenInfo?.error_message || "Token invalid/expired"),
        });

        if (!tokenInfo?.is_valid) {
          result.suggestions.push("Generate a new Page Access Token from Meta for Developers → Graph API Explorer");
          return Response.json(result);
        }

        const scopes = (tokenInfo?.scopes || []).map((s) => String(s).toLowerCase());
        const required = ["leads_retrieval", "pages_read_engagement", "pages_manage_ads"];
        const missing = required.filter((r) => !scopes.includes(r.toLowerCase()));

        result.checks.push({
          name: "Permissions",
          status: missing.length === 0 ? "ok" : "warning",
          message: missing.length === 0 ? `Has required: ${required.join(", ")}` : `Missing: ${missing.join(", ")}`,
          scopes: scopes,
        });

        if (missing.length > 0) {
          result.suggestions.push(
            "CRITICAL: Add pages_manage_ads permission. Meta requires it for leads. Graph API Explorer → Add Permission → pages_manage_ads → Generate new token."
          );
        }
      } else {
        result.checks.push({ name: "Token Debug", status: "skip", message: "Could not debug token (may need app token)" });
      }
    } catch (e) {
      result.checks.push({ name: "Token Debug", status: "skip", message: e.message });
    }

    // 2. Try to fetch form info directly
    if (formId) {
      const formRes = await fetch(
        `https://graph.facebook.com/v18.0/${formId}?fields=id,name,status&access_token=${token}`
      );
      const formData = await formRes.json();

      if (formData?.error) {
        result.checks.push({
          name: "Form ID",
          status: "error",
          message: formData.error.message || "Form not accessible",
          code: formData.error.code,
          subcode: formData.error.error_subcode,
        });
        result.suggestions.push(
          "FB_LEAD_FORM_ID might be wrong. Get correct ID from: Meta Business Suite → Ads Manager → Forms Library, or from the lead form URL."
        );
        result.suggestions.push("Ensure the form belongs to the Page linked to your token.");
      } else {
        result.checks.push({
          name: "Form ID",
          status: "ok",
          message: `Form exists: ${formData?.name || formData?.id}`,
        });
      }

      // 3. Try /leads endpoint (the actual failing call)
      const leadsRes = await fetch(
        `https://graph.facebook.com/v18.0/${formId}/leads?limit=1&fields=id&access_token=${token}`
      );
      const leadsData = await leadsRes.json();

      if (leadsData?.error) {
        result.checks.push({
          name: "Leads API",
          status: "error",
          message: leadsData.error.message,
          code: leadsData.error.code,
          subcode: leadsData.error.error_subcode,
        });
        if (leadsData.error.error_subcode === 33) {
          result.suggestions.push("Error 33 = permission/access issue. Token may lack leads_retrieval, or form ID is wrong.");
        }
      } else {
        result.checks.push({
          name: "Leads API",
          status: "ok",
          message: `Success. Leads count in first page: ${leadsData?.data?.length ?? 0}`,
        });
      }
    }

    // 4. If we have pageId, try to list leadgen forms on the page (helps find correct form ID)
    if (pageId) {
      const pageFormsRes = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/leadgen_forms?fields=id,name,status&access_token=${token}`
      );
      const pageFormsData = await pageFormsRes.json();

      if (pageFormsData?.data?.length) {
        result.checks.push({
          name: "Page Forms",
          status: "ok",
          message: `Found ${pageFormsData.data.length} lead form(s) on page`,
          forms: pageFormsData.data.map((f) => ({ id: f.id, name: f.name })),
        });
        if (formId && !pageFormsData.data.some((f) => String(f.id) === String(formId))) {
          result.suggestions.push(
            `Your FB_LEAD_FORM_ID (${formId}) is NOT in this page's forms. Try one of: ${pageFormsData.data.map((f) => f.id).join(", ")}`
          );
        }
      } else if (pageFormsData?.error) {
        result.checks.push({
          name: "Page Forms",
          status: "error",
          message: pageFormsData.error.message,
        });
      }
    }

    // 5. Try Ad Account leadgen_forms (works with ads_management, may bypass pages_manage_ads for form list)
    if (adAccountId) {
      const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
      const adFormsRes = await fetch(
        `https://graph.facebook.com/v18.0/${actId}/leadgen_forms?fields=id,name,status&access_token=${token}`
      );
      const adFormsData = await adFormsRes.json();

      if (adFormsData?.data?.length) {
        result.checks.push({
          name: "Ad Account Forms",
          status: "ok",
          message: `Found ${adFormsData.data.length} form(s) in Ad Account`,
          forms: adFormsData.data.map((f) => ({ id: f.id, name: f.name })),
        });
        const formIds = adFormsData.data.map((f) => f.id);
        if (formId && !formIds.includes(String(formId))) {
          result.suggestions.push(
            `Your FB_LEAD_FORM_ID (${formId}) not in Ad Account. Try: ${formIds.join(", ")}`
          );
        }
      } else if (adFormsData?.error) {
        const isNotSupported = adFormsData.error.message?.includes("nonexisting field");
        result.checks.push({
          name: "Ad Account Forms",
          status: isNotSupported ? "skip" : "error",
          message: isNotSupported
            ? "leadgen_forms not available on Ad Account (use Page Forms when pages_manage_ads is added)"
            : adFormsData.error.message,
        });
      }
    }

    // 6. DB Diagnosis: lead_distribution, customers count, Meta vs DB comparison
    try {
      const conn = await getDbConnection();

      // 6a. Lead distribution - reps for assigning leads
      let leadDistRows = [];
      try {
        const [ldRows] = await conn.execute(
          "SELECT username, priority, max_leads, assigned_count, is_active FROM lead_distribution ORDER BY priority ASC"
        );
        leadDistRows = ldRows || [];
      } catch (e) {
        try {
          const [ldRows] = await conn.execute(
            "SELECT username, priority, max_leads, assigned_count FROM lead_distribution ORDER BY priority ASC"
          );
          leadDistRows = ldRows || [];
        } catch (_) {}
      }

      const activeReps = leadDistRows.filter((r) => r.is_active === 1 || r.is_active === true);
      const hasActiveReps = activeReps.length > 0 || leadDistRows.length > 0;

      result.dbDiagnosis = {
        leadDistributionCount: leadDistRows.length,
        activeRepsCount: activeReps.length,
        reps: leadDistRows.map((r) => ({
          username: r.username,
          priority: r.priority,
          max_leads: r.max_leads,
          assigned_count: r.assigned_count,
          is_active: r.is_active,
        })),
      };

      if (!hasActiveReps) {
        result.checks.push({
          name: "Lead Distribution",
          status: "error",
          message: "No reps in lead_distribution. Webhook & backfill need reps to assign leads.",
        });
        result.suggestions.push(
          "Go to Lead Distribution page and add at least one rep (username, priority, max_leads). Enable is_active if column exists."
        );
      } else {
        result.checks.push({
          name: "Lead Distribution",
          status: "ok",
          message: `${activeReps.length || leadDistRows.length} rep(s) configured`,
        });
      }

      // 6b. Total customers in DB
      const [countRows] = await conn.execute("SELECT COUNT(*) AS total FROM customers");
      result.dbDiagnosis.totalCustomersInDb = countRows[0]?.total ?? 0;

      // 6c. Fetch last 5 leads from Meta and check if they exist in DB
      if (formId && token) {
        const leadsRes = await fetch(
          `https://graph.facebook.com/v18.0/${formId}/leads?limit=5&fields=field_data,ad_id,created_time,id&access_token=${token}`
        );
        const leadsData = await leadsRes.json();

        if (!leadsData?.error && Array.isArray(leadsData?.data) && leadsData.data.length > 0) {
          const getValue = (fieldData, name) =>
            fieldData.find((f) => f.name === name)?.values?.[0] || null;

          const metaLeads = leadsData.data.map((lead) => {
            const fd = lead.field_data || [];
            const rawPhone = getValue(fd, "phone_number");
            const phone = normalizePhone(rawPhone);
            return {
              leadgen_id: lead.id,
              created_time: lead.created_time,
              first_name: getValue(fd, "full_name") || getValue(fd, "first_name"),
              email: getValue(fd, "email"),
              phone,
              address: getValue(fd, "city"),
            };
          });

          const phonesToCheck = metaLeads.map((l) => l.phone).filter(Boolean);
          const foundPhones = new Set();

          if (phonesToCheck.length > 0) {
            const normalizedPhones = phonesToCheck.map((p) =>
              (p || "").replace(/\D/g, "").slice(-10)
            ).filter(Boolean);
            const conditions = normalizedPhones.map(() => "phone LIKE ?").join(" OR ");
            const params = normalizedPhones.map((p) => `%${p}%`);
            const [dbRows] = await conn.execute(
              `SELECT phone FROM customers WHERE ${conditions}`,
              params
            );
            (dbRows || []).forEach((r) => {
              const p = String(r.phone || "").replace(/\D/g, "").slice(-10);
              if (p) foundPhones.add(p);
            });
          }

          result.metaVsDb = {
            metaLeadsCount: metaLeads.length,
            metaLeadsSample: metaLeads.map((l) => ({
              name: l.first_name,
              phone: l.phone,
              email: l.email,
              created: l.created_time,
              inDb: l.phone ? foundPhones.has(String(l.phone).replace(/\D/g, "").slice(-10)) : false,
            })),
            inDbCount: metaLeads.filter((l) =>
              l.phone ? foundPhones.has(String(l.phone).replace(/\D/g, "").slice(-10)) : false
            ).length,
            notInDbCount: metaLeads.filter((l) =>
              l.phone ? !foundPhones.has(String(l.phone).replace(/\D/g, "").slice(-10)) : true
            ).length,
          };

          if (result.metaVsDb.notInDbCount > 0) {
            result.checks.push({
              name: "Meta vs DB",
              status: "warning",
              message: `${result.metaVsDb.notInDbCount} of last ${metaLeads.length} Meta leads NOT in database.`,
            });
            result.suggestions.push(
              "Leads from Meta are not reaching DB. Check: (1) Webhook subscribed in Meta App? (2) Webhook URL must be HTTPS in production. (3) Use 'Fetch Leads' + 'Import' on this page to manually backfill."
            );
          } else {
            result.checks.push({
              name: "Meta vs DB",
              status: "ok",
              message: `Last ${metaLeads.length} Meta leads found in DB`,
            });
          }
        } else if (leadsData?.data?.length === 0) {
          result.metaVsDb = { metaLeadsCount: 0, message: "No leads in Meta form yet" };
        }
      }
    } catch (dbErr) {
      result.dbDiagnosis = result.dbDiagnosis || {};
      result.dbDiagnosis.error = dbErr.message;
      result.checks.push({ name: "DB Diagnosis", status: "error", message: dbErr.message });
    }

    return Response.json(result);
  } catch (err) {
    result.checks.push({ name: "Diagnostic", status: "error", message: err.message });
    return Response.json(result);
  }
}
