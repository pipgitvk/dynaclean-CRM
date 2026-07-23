import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";
import PreBookingListClient from "./PreBookingListClient";

export const dynamic = "force-dynamic";

export default async function PreBookingPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload) {
    redirect("/login");
  }

  const searchParamsResolved = await searchParams;
  const {
    search = "",
    modelFilter = "",
    leadSourceFilter = "",
    expectedDateFrom = "",
    expectedDateTo = "",
    page = "1",
  } = searchParamsResolved;

  const currentPage = parseInt(page);
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;

  const conn = await getDbConnection();

  // Build query to fetch pre-bookings with customer details
  let query = `
    SELECT
      pb.*,
      c.first_name,
      c.last_name,
      c.lead_source,
      c.company,
      c.phone,
      c.email
    FROM pre_booking pb
    LEFT JOIN customers c ON pb.customer_id = c.customer_id
    WHERE 1=1
  `;

  const params = [];

  // Search filter - searches in customer ID, name, email, phone
  if (search && search.trim()) {
    query += ` AND (
      pb.customer_id LIKE ? OR 
      c.first_name LIKE ? OR 
      c.last_name LIKE ? OR 
      c.email LIKE ? OR 
      c.phone LIKE ? OR
      pb.product_name LIKE ?
    )`;
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  // Model filter removed
  
  // Lead Source filter
  if (leadSourceFilter && leadSourceFilter.trim()) {
    query += ` AND c.lead_source = ?`;
    params.push(leadSourceFilter);
  }

  // Expected Date From filter
  if (expectedDateFrom && expectedDateFrom.trim()) {
    query += ` AND DATE(pb.expected_date) >= ?`;
    params.push(expectedDateFrom);
  }

  // Expected Date To filter
  if (expectedDateTo && expectedDateTo.trim()) {
    query += ` AND DATE(pb.expected_date) <= ?`;
    params.push(expectedDateTo);
  }

  // Get total count
  const [countResult] = await conn.execute(
    query.replace(/SELECT\s+pb\.\*,[\s\S]*?FROM/, "SELECT COUNT(*) as count FROM"),
    params
  );
  const total = countResult[0]?.count || 0;

  // Get paginated results
  query += ` ORDER BY pb.created_at DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const [preBookings] = await conn.execute(query, params);

  // Get distinct lead sources for filter
  const [leadSources] = await conn.execute(`
    SELECT DISTINCT c.lead_source
    FROM customers c
    WHERE c.lead_source IS NOT NULL AND c.lead_source != ''
    ORDER BY c.lead_source
  `);

  return (
    <PreBookingListClient
      preBookings={preBookings}
      total={total}
      currentPage={currentPage}
      pageSize={pageSize}
      search={search}
      modelFilter={modelFilter}
      leadSourceFilter={leadSourceFilter}
      expectedDateFrom={expectedDateFrom}
      expectedDateTo={expectedDateTo}
      leadSources={leadSources.map((ls) => ls.lead_source)}
    />
  );
}
