import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { notesLanguageExistsSql } from "@/constants/notesLanguageOptions";

/** Map bulk-reassign / customers-table filter values to all status strings used in DB (forms vs legacy). */
function statusValuesForFilter(statusParam) {
    if (!statusParam) return null;
    const key = String(statusParam).trim();
    const map = {
        verygud: ["verygud", "Very Good"],
        average: ["average", "Average"],
        poor: ["poor", "Poor"],
        denied: ["denied", "Denied"],
        invalid: ["invalid", "Invalid"],
        old_reassign: ["old_reassign", "Old Reassign"],
        New: ["New"],
    };
    if (map[key]) return map[key];
    return [key];
}

/** Canonical Add Customer campaign keys → SQL (legacy stored values included). */
function leadCampaignFilterSql(campaignParam) {
    const key = String(campaignParam || "").trim().toLowerCase();
    if (!key) return null;
    const map = {
        india_mart: `LOWER(TRIM(c.lead_campaign)) IN ('india_mart', 'indiamart', 'india-mart')`,
        social_media:
            `LOWER(TRIM(c.lead_campaign)) IN ('social_media', 'facebook', 'instagram', 'meta', 'social')`,
        google_ads:
            `LOWER(TRIM(c.lead_campaign)) IN ('google_ads', 'google', 'google adwords', 'googleads')`,
        website_visit:
            `LOWER(TRIM(c.lead_campaign)) IN ('website_visit', 'website', 'website_direct', 'visit')`,
        direct_call: `LOWER(TRIM(c.lead_campaign)) IN ('direct_call', 'direct call')`,
        manager_assigned: `REPLACE(REPLACE(LOWER(TRIM(c.lead_campaign)), '_', ''), '-', '') IN ('managerassigned', 'managerassign')`,
    };
    return map[key] || null;
}

// GET - Fetch filtered leads for bulk operations
export async function GET(request) {
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only allow admin and sales roles
        if (!["ADMIN", "SUPERADMIN", "SALES", "SALES CUM BACKOFFICE"].includes(payload.role)) {
            return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const tags = searchParams.get("tags");
        const stage = searchParams.get("stage");
        const lead_source = searchParams.get("lead_source");
        const lead_campaign = searchParams.get("lead_campaign");
        const products_interest = searchParams.get("products_interest");
        const notes_language = searchParams.get("notes_language");
        const salesOnly = searchParams.get("sales_only") === "1";

        const connection = await getDbConnection();

        // Build query with filters
        let query = `
      SELECT
        c.customer_id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.status,
        c.stage,
        c.tags,
        c.lead_source,
        c.service_lead_source,
        c.gem_lead_source,
        c.assigned_to,
        c.sales_representative,
        c.lead_campaign,
        c.products_interest,
        c.date_created
      FROM
        customers c
      WHERE 1=1
    `;

        const params = [];

        // Apply filters
        if (status) {
            const statusVariants = statusValuesForFilter(status);
            if (statusVariants?.length) {
                query += ` AND c.status IN (${statusVariants.map(() => "?").join(", ")})`;
                params.push(...statusVariants);
            }
        }

        if (tags) {
            query += ` AND c.tags LIKE ?`;
            params.push(`%${tags}%`);
        }

        if (stage) {
            query += ` AND c.stage = ?`;
            params.push(stage);
        }

        if (lead_source) {
            query += ` AND c.lead_source = ?`;
            params.push(lead_source);
        }

        if (salesOnly) {
            query += ` AND c.lead_source IS NOT NULL AND TRIM(c.lead_source) <> ''`;
        }

        if (lead_campaign) {
            const campaignSql = leadCampaignFilterSql(lead_campaign);
            if (campaignSql) {
                query += ` AND ${campaignSql}`;
            } else {
                query += ` AND c.lead_campaign = ?`;
                params.push(lead_campaign);
            }
        }

        if (products_interest) {
            query += ` AND c.products_interest LIKE ?`;
            params.push(`%${products_interest}%`);
        }

        if (notes_language) {
            query += ` AND ${notesLanguageExistsSql("?")}`;
            params.push(notes_language);
        }

        // Order by most recent first (no limit - show all leads)
        query += ` ORDER BY c.date_created DESC`;

        const [rows] = await connection.execute(query, params);

        return NextResponse.json({
            success: true,
            customers: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("Error fetching bulk leads data:", error);
        return NextResponse.json(
            { error: "Failed to fetch leads data" },
            { status: 500 }
        );
    }
}
