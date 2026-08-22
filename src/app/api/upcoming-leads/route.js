import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  // 1. Log incoming URL and parameters
  const { searchParams } = new URL(request.url);
  const leadSource = searchParams.get("leadSource");
  console.log("Fetching data for leadSource:", leadSource);

  // sixHoursAhead needs to be defined
  // For example, you can calculate it here
  function getISTTime() {
    // Get current time in UTC
    const now = new Date();
    // Get the IST offset in minutes (5 hours and 30 minutes)
    const istOffset = 5.5 * 60;
    // Apply the offset to the current UTC time
    const istTime = new Date(now.getTime() + istOffset * 60 * 1000);
    return istTime;
  }

  const istNow = getISTTime();
  
  // Get date filters from query params
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  
  // If no date filter provided, default to current date
  const currentDateIST = istNow.toISOString().slice(0, 10); // YYYY-MM-DD format
  const defaultStartDate = startDate || currentDateIST;
  const defaultEndDate = endDate || currentDateIST;
  
  console.log("Date filters - Start:", defaultStartDate, "End:", defaultEndDate);

  try {
    const connection = await getDbConnection();
    console.log("Database connection established.");

    // 2. Updated SQL query with date filtering instead of 6-hour limit
    let sqlQuery = `
      SELECT *
FROM (
  SELECT
    cf.*,
    c.status,
    c.stage,
    c.first_name,
    c.phone,
    c.company,
    c.products_interest,
    ROW_NUMBER() OVER(PARTITION BY cf.customer_id ORDER BY cf.time_stamp DESC) AS rn
  FROM customers_followup cf
  INNER JOIN customers c ON cf.customer_id = c.customer_id
  WHERE c.lead_source = ? 
    AND c.status NOT IN ('DENIED', 'Invalid', 'Disqualified')
    AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
) AS T
WHERE T.rn = 1
  AND T.next_followup_date IS NOT NULL
  AND DATE(T.next_followup_date) >= ?
  AND DATE(T.next_followup_date) <= ?;
    `;
    const queryParams = [leadSource, defaultStartDate, defaultEndDate];
    console.log("Executing SQL query:", sqlQuery);
    console.log("With parameters:", queryParams);

    const [rows] = await connection.execute(sqlQuery, queryParams);

    // 3. Log the number of rows fetched
    console.log("Query executed successfully. Fetched rows:", rows.length);


    console.log("Database connection closed.");

    return NextResponse.json({
      leads: rows,
    });
  } catch (error) {
    // 4. Log any errors that occur
    console.error("An error occurred during API call:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}