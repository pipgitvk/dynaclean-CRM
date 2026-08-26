import { getDbConnection } from "@/lib/db";

export async function fetchDeniedLeads(searchParamsResolved = {}) {
  const {
    search,
    from,
    to,
    denied_from,
    denied_to,
    followed_by,
    page = "1",
  } = searchParamsResolved;

  const currentPage = parseInt(page, 10) || 1;
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;

  const connection = await getDbConnection();

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
  const totalRecords = countResult[0].total;
  const totalPages = Math.ceil(totalRecords / pageSize);

  query += ` ORDER BY COALESCE(denied_cf.followed_date, c.date_created) DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const [rows] = await connection.execute(query, params);

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
  const employees = empRows.map((row) => row.employee).filter(Boolean);

  return {
    deniedLeads: rows,
    totalRecords,
    totalPages,
    currentPage,
    pageSize,
    employees,
  };
}
