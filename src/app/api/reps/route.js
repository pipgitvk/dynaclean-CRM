import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";



export async function GET() {
  try {
    console.log("Fetching reps list...");
    
    const conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT username FROM rep_list ORDER BY username`);
        // await conn.end();

    return NextResponse.json({ users: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ users: [] });
  }
}
