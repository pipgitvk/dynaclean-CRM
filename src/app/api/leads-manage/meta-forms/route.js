import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { checkMetaCredentialsAccess } from "@/lib/checkMetaCredentialsAccess";
import { getDbConnection } from "@/lib/db";
import { getAllCredentials } from "@/lib/mysql/metaCredentialModel";

export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const access = await checkMetaCredentialsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: "You do not have access to Meta forms." },
        { status: 403 },
      );
    }

    const credentials = await getAllCredentials(true);
    const formIds = new Set();
    for (const cred of credentials) {
      (cred.formIds || []).forEach((id) => {
        const s = String(id || "").trim();
        if (s) formIds.add(s);
      });
    }

    const campaignByForm = new Map();
    const ids = [...formIds];
    if (ids.length > 0) {
      const conn = await getDbConnection();
      const placeholders = ids.map(() => "?").join(", ");
      const [rows] = await conn.execute(
        `SELECT ml.form_id, ml.campaign_name
         FROM meta_leads ml
         INNER JOIN (
           SELECT form_id, MAX(id) AS max_id
           FROM meta_leads
           WHERE form_id IN (${placeholders})
             AND TRIM(COALESCE(campaign_name, '')) != ''
           GROUP BY form_id
         ) latest ON ml.id = latest.max_id`,
        ids,
      );
      for (const row of rows) {
        const fid = String(row.form_id || "").trim();
        const name = String(row.campaign_name || "").trim();
        if (fid && name) campaignByForm.set(fid, name);
      }
    }

    const forms = ids
      .map((formId) => ({
        formId,
        campaignName: campaignByForm.get(formId) || "",
      }))
      .sort((a, b) => {
        const ca = (a.campaignName || a.formId).toLowerCase();
        const cb = (b.campaignName || b.formId).toLowerCase();
        return ca.localeCompare(cb);
      });

    return NextResponse.json({ success: true, data: forms });
  } catch (error) {
    console.error("[leads-manage/meta-forms]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}