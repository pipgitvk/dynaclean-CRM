import { getDbConnection } from "@/lib/db";
import DeniedLeadsTable from "./DeniedLeadsTable";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DeniedLeadsPage({ searchParams }) {
  let connection;
  let deniedLeads = [];
  let totalRecords = 0;
  let totalPages = 1;
  let error = null;
  let employees = [];

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
    from,
    to,
    followed_by,
    page = "1",
  } = searchParamsResolved;

  const currentPage = parseInt(page);
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;

  try {
    connection = await getDbConnection();

    let query = `
      SELECT
        cf.customer_id,
        cf.name,
        cf.contact,
        cf.notes,
        cf.followed_date,
        cf.next_followup_date,
        cf.followed_by,
        c.status as customer_status,
        c.stage as customer_stage
      FROM
        customers_followup cf
      JOIN
        customers c ON cf.customer_id = c.customer_id
      WHERE
        cf.notes LIKE '%marked%Denied%'
    `;

    const params = [];

    if (search) {
      query += ` AND (cf.customer_id = ? OR cf.contact LIKE ? OR cf.name LIKE ? OR cf.followed_by LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(search, searchTerm, searchTerm, searchTerm);
    }

    if (followed_by) {
      query += ` AND cf.followed_by = ?`;
      params.push(followed_by);
    }

    if (from) {
      query += ` AND DATE(cf.followed_date) >= ?`;
      params.push(from);
    }

    if (to) {
      query += ` AND DATE(cf.followed_date) <= ?`;
      params.push(to);
    }

    let countQuery = query.replace(
      /SELECT[\s\S]*?FROM\s+customers_followup cf/,
      "SELECT COUNT(*) as total FROM customers_followup cf",
    );
    const [countResult] = await connection.execute(countQuery, params);
    totalRecords = countResult[0].total;
    totalPages = Math.ceil(totalRecords / pageSize);

    query += ` ORDER BY cf.followed_date DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const [rows] = await connection.execute(query, params);
    deniedLeads = rows;

    // Collect distinct employees from current denied leads data
    const uniqueEmployees = [...new Set(deniedLeads.map(row => row.followed_by).filter(Boolean))];
    uniqueEmployees.sort();
    employees = uniqueEmployees;
  } catch (err) {
    console.error("Database query error:", err);
    error = "Failed to fetch data from the database.";
    employees = [];
  } finally {
  }

  return (
    <div className="min-h-screen bg-gray-100 p-3 sm:p-4 md:p-6 lg:p-8">
      <h2 className="text-xl sm:text-2xl md:text-3xl text-center text-gray-900 mb-2 sm:mb-0.5">Denied Leads</h2>

      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-xl p-3 sm:p-4 md:p-6 lg:p-8 overflow-hidden">
        <DeniedLeadsTable
          data={deniedLeads}
          error={error}
          searchParams={searchParamsResolved}
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={pageSize}
          userRole={userRole}
          employees={employees}
        />
      </div>
    </div>
  );
}
