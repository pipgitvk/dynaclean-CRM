import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const db = await getDbConnection();

    const [dbInfo] = await db.query(`
      SELECT 
        DATABASE() AS db,
        @@hostname AS mysqlHost,
        @@server_id AS serverId,
        @@port AS mysqlPort,
        NOW() AS nowTime,
        CURDATE() AS today
    `);

    const [latest] = await db.query(`
      SELECT id, username, date, checkin_time, created_at
      FROM attendance_logs
      ORDER BY id DESC
      LIMIT 10
    `);

    const [sakshi] = await db.query(`
      SELECT id, username, date, checkin_time, created_at
      FROM attendance_logs
      WHERE username = 'sakshi'
      ORDER BY id DESC
      LIMIT 10
    `);

    return NextResponse.json({
      success: true,
      dbInfo: dbInfo[0],
      latest,
      sakshi,
      envHost: process.env.DB_HOST,
      envDb: process.env.DB_NAME,
      envUser: process.env.DB_USER,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code || null,
        sqlMessage: error.sqlMessage || null,
      },
      { status: 500 }
    );
  }
}
