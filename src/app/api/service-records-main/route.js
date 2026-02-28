// app/api/service-records/route.js
import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const companySearch = searchParams.get('company_search') || '';
  const assignedSearch = searchParams.get('assigned_search') || '';
  const generalSearch = searchParams.get('general_search') || '';

  let conn;
  try {
    conn = await getDbConnection();
    let sql = `
      SELECT
        sr.*,
        wp.customer_name AS customer_name_from_wp,
        wp.contact_person AS contact_person_from_wp,
        wp.installed_address AS installed_address_from_wp
      FROM service_records sr
      LEFT JOIN warranty_products wp ON TRIM(sr.serial_number) COLLATE utf8mb4_unicode_ci = TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci

    `;
    const params = [];
    const whereClauses = [];

    if (companySearch) {
      // Prioritize company search
      whereClauses.push(`LOWER(TRIM(wp.customer_name)) LIKE LOWER(?)`);
      params.push(`%${companySearch.trim()}%`);
    } else if (assignedSearch) {
      // Prioritize assigned search
      whereClauses.push(`LOWER(sr.assigned_to) LIKE LOWER(?)`);
      params.push(`%${assignedSearch.trim()}%`);
    } else if (generalSearch) {
      // General search logic
      const searchTerms = generalSearch.split(' ').filter(Boolean);
      const termClauses = [];
      for (const term of searchTerms) {
        termClauses.push(`(
          sr.reg_date LIKE ? OR
          sr.serial_number LIKE ? OR
          sr.service_type LIKE ? OR
          sr.complaint_date LIKE ? OR
          sr.complaint_summary LIKE ? OR
          sr.assigned_to LIKE ? OR
          sr.service_id LIKE ? OR
          sr.action_taken LIKE ? OR
          sr.parts_replaced LIKE ? OR
          sr.service_description LIKE ? OR
          sr.status LIKE ? OR
          sr.company_cost LIKE ? OR
          sr.completed_date LIKE ? OR
          sr.attachments LIKE ? OR
          wp.customer_name LIKE ? OR
          wp.installed_address LIKE ?
        )`);
        const likeTerm = `%${term}%`;
        params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
      }
      if (termClauses.length > 0) {
        whereClauses.push(`(${termClauses.join(' AND ')})`);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` ORDER BY sr.service_id DESC`;

    const [rows] = await conn.execute(sql, params);

    // Map the results to ensure customer_name and installed_address are always present
    // Fallback: customer_name -> contact_person -> customer_address -> N/A
    const serviceRecords = rows.map(row => ({
      ...row,
      customer_name: row.customer_name_from_wp || row.contact_person_from_wp || 'N/A',
      installed_address: row.installed_address_from_wp || 'N/A',
    }));

    console.log(`Fetched ${serviceRecords.length} service records with filters: company_search="${companySearch}", assigned_search="${assignedSearch}", general_search="${generalSearch}"`);
    console.log(`this is the service records`, serviceRecords);
    
    


    return NextResponse.json(serviceRecords);

  } catch (error) {
    console.error('Error fetching service records:', error);
    return NextResponse.json({ error: 'Failed to fetch service records.', details: error.message }, { status: 500 });
  } finally {
  console.log("🔚 DB connection closed.");
  
  }
}