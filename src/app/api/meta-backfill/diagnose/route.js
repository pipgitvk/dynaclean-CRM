/**
 * GET /api/meta-backfill/diagnose
 * Diagnose Meta/Facebook Lead Ads API configuration
 * Helps identify: wrong form ID, token permissions, token expiry
 */
export async function GET() {
  const token = process.env.FB_PAGE_TOKEN;
  const formId = process.env.FB_LEAD_FORM_ID;
  const pageId = process.env.FB_PAGE_ID;
  const adAccountId = process.env.FB_AD_ACCOUNT_ID;

  const result = {
    configured: { token: !!token, formId: !!formId, pageId: !!pageId, adAccountId: !!adAccountId },
    formId: formId || null,
    pageId: pageId || null,
    checks: [],
    suggestions: [],
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

    return Response.json(result);
  } catch (err) {
    result.checks.push({ name: "Diagnostic", status: "error", message: err.message });
    return Response.json(result);
  }
}
