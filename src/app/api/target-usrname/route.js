// app/api/usernames/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  try {
    const connection = await getDbConnection();

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    let sql;
    let params = [];

    if (startDate && endDate) {
      // Filter out users who already have targets for the overlapping period
      sql = `
        SELECT DISTINCT rl.username 
        FROM rep_list rl
        LEFT JOIN target t ON rl.username COLLATE utf8mb4_unicode_ci = t.username COLLATE utf8mb4_unicode_ci
          AND (
            (t.target_start_date <= ? AND t.target_end_date >= ?)
            OR (t.target_start_date <= ? AND t.target_end_date >= ?)
            OR (t.target_start_date >= ? AND t.target_end_date <= ?)
          )
        WHERE rl.userRole IN ('BACK OFFICE', 'SALES', 'SALES HEAD', 'TEAM LEADER', 'GEM PORTAL') 
          AND rl.userRole NOT IN ('ADMIN')
          AND (rl.status = 1)
          AND t.username IS NULL
        ORDER BY rl.username;
      `;
      params = [endDate, startDate, startDate, endDate, startDate, endDate];
    } else {
      // No date filtering - return all eligible users
      sql = `
        SELECT username 
        FROM rep_list 
        WHERE userRole IN ('BACK OFFICE', 'SALES', 'SALES HEAD', 'TEAM LEADER', 'GEM PORTAL') 
          AND userRole NOT IN ('ADMIN')
          AND (status = 1)
        ORDER BY username;
      `;
    }

    const [rows] = await connection.execute(sql, params);



    const usernames = rows.map(row => row.username);

    return NextResponse.json(usernames, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch usernames:", error);
    return NextResponse.json({ message: "Failed to fetch usernames.", error: error.message }, { status: 500 });
  }
}