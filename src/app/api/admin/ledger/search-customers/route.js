import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function GET(request) {
  try {
    // Verify token
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      console.log("[ledger API] No token found");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    } catch (err) {
      console.log("[ledger API] Token verification failed:", err.message);
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get search query
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";

    console.log("[ledger API] Search query received:", query);

    if (!query || query.length < 1) {
      console.log("[ledger API] Query too short");
      return Response.json({ companies: [] });
    }

    const conn = await getDbConnection();

    const searchPattern = `%${query}%`;
    const startPattern = `${query}%`;

    console.log("[ledger API] Executing search with pattern:", searchPattern);

    const [customerResults] = await conn.execute(
      `SELECT DISTINCT
         customer_id,
         company AS company_name,
         phone AS mobile,
         gstin AS gst_in
       FROM customers
       WHERE 
         (company LIKE ? 
          OR phone LIKE ? 
          OR CAST(customer_id AS CHAR) LIKE ?
          OR gstin LIKE ?)
         AND company IS NOT NULL 
         AND company != ''
       ORDER BY 
         CASE 
           WHEN company LIKE ? THEN 0
           ELSE 1
         END,
         company ASC
       LIMIT 20`,
      [searchPattern, searchPattern, searchPattern, searchPattern, startPattern]
    );

    const [invoiceResults] = await conn.execute(
      `SELECT DISTINCT
         COALESCE(i.customer_id, c.customer_id) AS customer_id,
         TRIM(i.customer_name) AS company_name,
         c.phone AS mobile,
         c.gstin AS gst_in
       FROM invoices i
       LEFT JOIN customers c ON 
         LOWER(TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')))) = LOWER(TRIM(i.customer_name))
         OR LOWER(TRIM(c.company)) = LOWER(TRIM(i.customer_name))
         OR LOWER(TRIM(c.first_name)) = LOWER(TRIM(i.customer_name))
       WHERE i.customer_name IS NOT NULL
         AND TRIM(i.customer_name) != ''
         AND TRIM(i.customer_name) LIKE ?
       GROUP BY TRIM(i.customer_name), COALESCE(i.customer_id, c.customer_id), c.phone, c.gstin
       ORDER BY 
         CASE 
           WHEN TRIM(i.customer_name) LIKE ? THEN 0
           ELSE 1
         END,
         TRIM(i.customer_name) ASC
       LIMIT 20`,
      [searchPattern, startPattern]
    );

    const seen = new Map();
    for (const row of customerResults) {
      if (row.company_name) {
        seen.set(row.company_name.trim().toLowerCase(), {
          customer_id: row.customer_id,
          company_name: row.company_name || "",
          mobile: row.mobile || null,
          gst_in: row.gst_in || null,
        });
      }
    }
    for (const row of invoiceResults) {
      if (row.company_name) {
        const key = row.company_name.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, {
            customer_id: row.customer_id,
            company_name: row.company_name || "",
            mobile: row.mobile || null,
            gst_in: row.gst_in || null,
          });
        } else if (!seen.get(key).customer_id && row.customer_id) {
          seen.get(key).customer_id = row.customer_id;
        }
      }
    }

    const companies = Array.from(seen.values()).slice(0, 20);

    console.log(`[ledger API] Query: "${query}", customers: ${customerResults.length}, invoices: ${invoiceResults.length}, combined: ${companies.length}`);
    if (companies.length > 0) {
      console.log("[ledger API] First result:", companies[0]);
    }

    return Response.json({ companies, count: companies.length });
  } catch (error) {
    console.error("[ledger search] Error:", error);
    return Response.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
