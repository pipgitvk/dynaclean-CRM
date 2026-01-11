// // pages/api/daily-followups.js
// import { NextResponse } from 'next/server';
// import { getDbConnection } from "@/lib/db";  // Assuming you have a DB connection helper

// export async function GET(req) {
//   console.log("API: daily-followups called");
//   const { searchParams } = new URL(req.url);
//   console.log("URL Search Params:", searchParams.toString());
  
//   const leadSource = searchParams.get('lead_source') || '';
//   const dateFrom = searchParams.get('date_from') || '';
//   const dateTo = searchParams.get('date_to') || '';
//   const commMode = searchParams.get('communication_mode') || '';
  
//   const conn = await getDbConnection();

//   // Prepare SQL query  
//   let query = `
//     SELECT 
//       cf.customer_id, 
//       cf.name, 
//       c.company, 
//       cf.followed_date, 
//       cf.next_followup_date, 
//       cf.comm_mode,

//       -- Fetch notes for the selected date
//       (SELECT notes FROM customers_followup 
//        WHERE customer_id = cf.customer_id 
//        AND DATE(followed_date) = DATE(?) 
//        ORDER BY followed_date DESC LIMIT 1) AS selected_date_notes,

//       -- Fetch the latest (most recent) note
//       (SELECT notes FROM customers_followup 
//        WHERE customer_id = cf.customer_id 
//        ORDER BY followed_date DESC LIMIT 1) AS max_current_date_notes
//     FROM customers_followup cf
//     JOIN customers c ON cf.customer_id = c.customer_id
//     WHERE 1=1
//   `;

//   const params = [dateFrom];  // Default param for the subquery
//   let types = "s";  // SQL type for date parameter

//   // Applying the filters dynamically
//   if (dateFrom && dateTo) {
//      console.log("Filtering by followed_date and next_followup_date");
//     query += " AND DATE(cf.followed_date) BETWEEN ? AND ?";
//     params.push(dateFrom, dateTo);
//     types += "ss";
//   } else if (dateFrom) {
//     console.log("Filtering by followed_date only");
//     query += " AND DATE(cf.followed_date) = ?";
//     params.push(dateFrom);
//     types += "s";
//   }

//    if (!dateFrom && dateTo) {
//  console.log("Filtering by next_followup_date only");
//  query += " AND DATE(cf.next_followup_date) = ?";
//  params.push(dateTo);
//  types += "s";
//  }

//   if (leadSource) {
//     query += " AND c.lead_source = ?";
//     params.push(leadSource);
//     types += "s";
//   }

//   if (commMode) {
//     query += " AND cf.comm_mode = ?";
//     params.push(commMode);
//     types += "s";
//   }

//   query += " GROUP BY cf.customer_id ORDER BY cf.followed_date ASC";  // Same ordering as in PHP

//   // Prepare and execute the query

//  console.log("Final SQL Query:", query);
// console.log("Final SQL Parameters:", params);
//   const [rows] = await conn.query(query, params);
// pages/api/daily-followups.js
import { NextResponse } from 'next/server';
import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  console.log("API: daily-followups called (Window Function Version)");
  const { searchParams } = new URL(req.url);
  
  const leadSource = searchParams.get('lead_source') || '';
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo = searchParams.get('date_to') || '';
  const commMode = searchParams.get('communication_mode') || '';

  const conn = await getDbConnection();

  // We'll build the WHERE clause and params dynamically
  let whereConditions = [];
  const params = [];

  // Filter for Followed Date OR Next Follow-up Date
  const dateConditions = [];
  if (dateFrom) {
    dateConditions.push("DATE(cf.followed_date) = ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    dateConditions.push("DATE(cf.next_followup_date) = ?");
    params.push(dateTo);
  }
  if (dateConditions.length > 0) {
    whereConditions.push("(" + dateConditions.join(" OR ") + ")");
  }

  // Other filters
  if (leadSource) {
    whereConditions.push("c.lead_source = ?");
    params.push(leadSource);
  }
  if (commMode) {
    whereConditions.push("cf.comm_mode = ?");
    params.push(commMode);
  }

  let whereClause = '';
  if (whereConditions.length > 0) {
    whereClause = "WHERE " + whereConditions.join(" AND ");
  }

  const query = `
    WITH RankedFollowups AS (
      SELECT
        cf.customer_id, 
        cf.name, 
        c.company, 
        cf.followed_date, 
        cf.next_followup_date, 
        cf.comm_mode,
        cf.notes,
        ROW_NUMBER() OVER (PARTITION BY cf.customer_id ORDER BY cf.followed_date DESC) as rn
      FROM customers_followup cf
      JOIN customers c ON cf.customer_id = c.customer_id
      ${whereClause}
    )
    SELECT
      customer_id,
      name,
      company,
      followed_date,
      next_followup_date,
      comm_mode,
      -- We can't directly get 'selected_date_notes' with a window function in this way
      -- because the filter is on the followed_date. We need to do a separate subquery for it.
      -- This is a hybrid approach.
      (SELECT notes FROM customers_followup 
       WHERE customer_id = RankedFollowups.customer_id 
       AND DATE(followed_date) = ? 
       ORDER BY followed_date DESC LIMIT 1) AS selected_date_notes,
      notes AS max_current_date_notes
    FROM RankedFollowups
    WHERE rn = 1
    ORDER BY followed_date ASC;
  `;
  
  // Add the dateFrom parameter for the subquery
  const finalParams = [dateFrom, ...params];

  console.log("Final SQL Query (Hybrid):", query);
  console.log("Final SQL Parameters:", finalParams);

  try {
    const [rows] = await conn.query(query, finalParams);
        // await conn.end();
    console.log("Query executed successfully. Found", rows.length, "records.");
    
    return NextResponse.json({ records: rows });
  } catch (error) {
    console.error("Error executing query:", error);
        // await conn.end();
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}