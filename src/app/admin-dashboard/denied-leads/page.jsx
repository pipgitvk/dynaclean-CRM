import { getDbConnection } from "@/lib/db";
import DeniedLeadsTable from "./DeniedLeadsTable";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { resolveModuleAccess, applySuperadminOnlyModuleRestrictions, applyRoleDenyModuleRestrictions } from "@/lib/moduleAccess";
import { redirect } from "next/navigation";

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

  // Check module access for denied-leads
  const roleKey = normalizeRoleKey(userRole) || "GUEST";
  if (roleKey !== "SUPERADMIN") {
    try {
      connection = await getDbConnection();
      const [rows] = await connection.execute(
        "SELECT module_access, userRole FROM rep_list WHERE username = ? LIMIT 1",
        [username]
      );

      let allowedModules = null;
      if (rows.length > 0) {
        allowedModules = resolveModuleAccess(rows[0].module_access ?? null, rows[0].userRole ?? userRole);
        allowedModules = applySuperadminOnlyModuleRestrictions(allowedModules, roleKey);
        allowedModules = applyRoleDenyModuleRestrictions(allowedModules, roleKey);
      }

      // Check if denied-leads is in allowed modules
      if (!allowedModules || !allowedModules.includes("denied-leads")) {
        redirect("/admin-dashboard");
      }
    } catch (err) {
      console.error("Error checking module access:", err);
      redirect("/admin-dashboard");
    }
  }

  const searchParamsResolved = await searchParams;
  const {
    search,
    from,
    to,
    denied_from,
    denied_to,
    followed_by,
    page = "1",
  } = searchParamsResolved;

  const currentPage = parseInt(page);
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;

  try {
    connection = await getDbConnection();

    const whereConditions = [
      "(c.status = 'Denied' OR denied_cf.customer_id IS NOT NULL)",
    ];
    const params = [];

    if (search) {
      const searchTerm = `%${search}%`;
      whereConditions.push(`
        (
          CAST(c.customer_id AS CHAR) = ?
          OR CAST(c.customer_id AS CHAR) LIKE ?
          OR COALESCE(denied_cf.contact, CAST(c.phone AS CHAR), '') LIKE ?
          OR COALESCE(denied_cf.name, CONCAT(TRIM(COALESCE(c.first_name, '')), ' ', TRIM(COALESCE(c.last_name, ''))), c.company, '') LIKE ?
          OR COALESCE(denied_cf.followed_by, c.lead_source, '') LIKE ?
        )
      `);
      params.push(search, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (followed_by) {
      whereConditions.push("COALESCE(NULLIF(denied_cf.followed_by, ''), c.lead_source, '') = ?");
      params.push(followed_by);
    }

    if (from) {
      whereConditions.push("DATE(COALESCE(denied_cf.followed_date, c.date_created)) >= ?");
      params.push(from);
    }

    if (to) {
      whereConditions.push("DATE(COALESCE(denied_cf.followed_date, c.date_created)) <= ?");
      params.push(to);
    }

    if (denied_from) {
      whereConditions.push("DATE(COALESCE(denied_cf.followed_date, c.date_created)) >= ?");
      params.push(denied_from);
    }

    if (denied_to) {
      whereConditions.push("DATE(COALESCE(denied_cf.followed_date, c.date_created)) <= ?");
      params.push(denied_to);
    }

    const whereClause = whereConditions.join(" AND ");

    const baseQuery = `
      FROM
        customers c
      LEFT JOIN (
        SELECT customer_id, name, contact, notes, followed_date, next_followup_date, followed_by
        FROM (
          SELECT
            cf.customer_id,
            cf.name,
            cf.contact,
            cf.notes,
            cf.followed_date,
            cf.next_followup_date,
            cf.followed_by,
            ROW_NUMBER() OVER (
              PARTITION BY cf.customer_id
              ORDER BY cf.followed_date DESC
            ) AS rn
          FROM customers_followup cf
          WHERE cf.notes LIKE '%marked%Denied%'
        ) latest_denied
        WHERE latest_denied.rn = 1
      ) denied_cf ON denied_cf.customer_id = c.customer_id
      WHERE ${whereClause}
    `;

    let query = `
      SELECT
        c.customer_id,
        COALESCE(
          denied_cf.name,
          NULLIF(CONCAT(TRIM(COALESCE(c.first_name, '')), ' ', TRIM(COALESCE(c.last_name, ''))), ''),
          c.company,
          '—'
        ) AS name,
        COALESCE(denied_cf.contact, CAST(c.phone AS CHAR), '') AS contact,
        COALESCE(denied_cf.notes, 'Customer status is Denied') AS notes,
        denied_cf.followed_date,
        COALESCE(denied_cf.followed_date, c.date_created) AS denied_date,
        denied_cf.next_followup_date,
        COALESCE(NULLIF(denied_cf.followed_by, ''), c.lead_source, '—') AS followed_by,
        c.status as customer_status,
        c.stage as customer_stage
      ${baseQuery}
    `;

    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countResult] = await connection.execute(countQuery, params);
    totalRecords = countResult[0].total;
    totalPages = Math.ceil(totalRecords / pageSize);

    query += ` ORDER BY COALESCE(denied_cf.followed_date, c.date_created) DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const [rows] = await connection.execute(query, params);
    deniedLeads = rows;

    // Fetch distinct employees from ALL denied leads in the database (not just current page)
    // All users with module access see ALL denied leads - no automatic followed_by filtering
    const [empRows] = await connection.execute(
      `SELECT DISTINCT employee FROM (
         SELECT COALESCE(NULLIF(cf.followed_by, ''), c.lead_source) AS employee
         FROM customers c
         LEFT JOIN customers_followup cf
           ON cf.customer_id = c.customer_id
          AND cf.notes LIKE '%marked%Denied%'
         WHERE c.status = 'Denied' OR cf.customer_id IS NOT NULL
       ) all_denied_employees
       WHERE employee IS NOT NULL AND employee != ''
       ORDER BY employee`
    );
    employees = empRows.map(row => row.employee).filter(Boolean);
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
