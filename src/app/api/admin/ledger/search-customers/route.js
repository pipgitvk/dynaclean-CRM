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
      return Response.json({ customers: [] });
    }

    const conn = await getDbConnection();

    // Build search query - search in company, phone, customer_id, and gstin
    const searchPattern = `%${query}%`;
    const startPattern = `${query}%`;

    console.log("[ledger API] Executing search with pattern:", searchPattern);

    // Search from customers table - group by company
    const [results] = await conn.execute(
      `SELECT DISTINCT
         customer_id,
         company,
         phone,
         gstin
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

    console.log(`[ledger API] Query: "${query}", Results: ${results.length}`);
    if (results.length > 0) {
      console.log("[ledger API] First result:", results[0]);
    }

    // Format results
    const companies = results.map((row) => ({
      customer_id: row.customer_id,
      company_name: row.company || "",
      mobile: row.phone || null,
      gst_in: row.gstin || null,
    }));

    return Response.json({ companies, count: results.length });
  } catch (error) {
    console.error("[ledger search] Error:", error);
    return Response.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
