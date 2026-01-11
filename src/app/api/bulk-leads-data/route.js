import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch filtered leads for bulk operations
export async function GET(request) {
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only allow admin roles
        if (!["ADMIN", "SUPERADMIN"].includes(payload.role)) {
            return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const tags = searchParams.get("tags");
        const stage = searchParams.get("stage");
        const lead_source = searchParams.get("lead_source");
        const lead_campaign = searchParams.get("lead_campaign");
        const products_interest = searchParams.get("products_interest");

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
            query += ` AND c.status = ?`;
            params.push(status);
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

        if (lead_campaign) {
            query += ` AND c.lead_campaign = ?`;
            params.push(lead_campaign);
        }

        if (products_interest) {
            query += ` AND c.products_interest LIKE ?`;
            params.push(`%${products_interest}%`);
        }

        // Order by most recent first and limit results
        query += ` ORDER BY c.date_created DESC LIMIT 500`;

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
