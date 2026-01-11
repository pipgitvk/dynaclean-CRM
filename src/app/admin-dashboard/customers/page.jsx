import { getDbConnection } from "@/lib/db";
import CustomerTable from "./CustomerTable"; // Import the new component
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

// This is a Server Component, meaning it runs on the server.
export default async function HomePage({ searchParams }) {
  let connection;
  let customers = [];
  let leadSources = [];
  let totalRecords = 0;
  let totalPages = 1;
  let error = null;

  let username = "Unknown";
  let userRole = null;
  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }
  username = payload.username;
  userRole = payload.role;

  const searchParamsResolved = await searchParams;
  const { 
    search, 
    lead_source, 
    lead_campaign, 
    status, 
    stage,
    from, 
    to,
    page = '1' 
  } = searchParamsResolved;

  const currentPage = parseInt(page);
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;

  try {
    connection = await getDbConnection();
    
    // Build query with filters
    let query = `
      SELECT
        c.*,
        cf.notes AS latest_note
      FROM
        customers c
      LEFT JOIN (
        SELECT
          customer_id,
          notes,
          ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY time_stamp DESC) AS rn
        FROM
          customers_followup
      ) cf ON c.customer_id = cf.customer_id AND cf.rn = 1
      WHERE 1=1
    `;

    const params = [];

    // Apply filters
    if (search) {
      query += ` AND (c.customer_id = ? OR c.phone LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(search, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (lead_source) {
      query += ` AND c.lead_source = ?`;
      params.push(lead_source);
    }

    if (lead_campaign) {
      query += ` AND c.lead_campaign = ?`;
      params.push(lead_campaign);
    }

    if (status) {
      query += ` AND c.status = ?`;
      params.push(status);
    }

    if (stage) {
      query += ` AND c.stage = ?`;
      params.push(stage);
    }

    if (from) {
      query += ` AND c.date_created >= ?`;
      params.push(from);
    }

    if (to) {
      query += ` AND c.date_created <= ?`;
      params.push(to);
    }

    // Get total count
    let countQuery = query.replace(/SELECT[\s\S]*?FROM\s+customers c/, 'SELECT COUNT(*) as total FROM customers c');
    const [countResult] = await connection.execute(countQuery, params);
    totalRecords = countResult[0].total;
    totalPages = Math.ceil(totalRecords / pageSize);

    // Add pagination
    query += ` ORDER BY c.date_created DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const [rows] = await connection.execute(query, params);
    customers = rows;

    // Fetch lead sources for filter (used as employee list)
    const [sources] = await connection.execute(
      `SELECT DISTINCT lead_source FROM customers WHERE lead_source IS NOT NULL ORDER BY lead_source`
    );
    leadSources = sources.map(s => s.lead_source);

  } catch (err) {
    console.error("Database query error:", err);
    error = "Failed to fetch data from the database.";
  } finally {
    if (connection) {
      // await connection.end(); // Always close the connection
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <h2 className="text-3xl text-center text-gray-900 mb-0.5">
        All Clients
      </h2>

      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-xl p-6 md:p-8">
        {/* Render the CustomerTable component, passing the fetched data and error */}
        <CustomerTable 
          data={customers} 
          error={error}
          leadSources={leadSources}
          searchParams={searchParamsResolved}
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={pageSize}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
