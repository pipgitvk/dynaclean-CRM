// /api/attendance/checkin/route.js
import { getDbConnection } from "@/lib/db";
import { getISTDateString, getISTDateTimeString } from "@/lib/istDateTime";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function POST() {
  try {
    console.log("🔥 CHECKIN API HIT");
    console.log("🔥 Request time:", new Date().toISOString());

    const cookieStore = await cookies();
    const username = cookieStore.get("username")?.value;

    console.log("🔥 Username from cookie:", username);

    if (!username) {
      return noStoreJson(
        {
          success: false,
          error: "Not logged in",
          debug: "username cookie missing",
        },
        401
      );
    }

    const conn = await getDbConnection();

    const [dbInfoRows] = await conn.query(`
      SELECT 
        DATABASE() AS db,
        @@hostname AS host,
        @@server_id AS serverId,
        NOW() AS nowTime,
        CURDATE() AS today
    `);

    const dbInfo = dbInfoRows[0];

    console.log("🔥 DB INFO:", dbInfo);

    const today = getISTDateString();
    const checkinTime = getISTDateTimeString();

    console.log("🔥 IST today:", today);
    console.log("🔥 IST checkinTime:", checkinTime);

    const [existingRows] = await conn.execute(
      `SELECT id, username, date, checkin_time, created_at
       FROM attendance_logs
       WHERE username = ? AND date = ?
       LIMIT 1`,
      [username, today]
    );

    console.log("🔥 Existing attendance rows:", existingRows);

    if (existingRows.length > 0) {
      return noStoreJson(
        {
          success: true,
          alreadyCheckedIn: true,
          message: "Already checked in",
          dbInfo,
          today,
          existingRow: existingRows[0],
        },
        200
      );
    }

    const [insertResult] = await conn.execute(
      `INSERT INTO attendance_logs 
       (username, date, checkin_time)
       VALUES (?, ?, ?)`,
      [username, today, checkinTime]
    );

    console.log("🔥 CHECKIN INSERT RESULT:", insertResult);

    const [verifyRows] = await conn.execute(
      `SELECT id, username, date, checkin_time, created_at
       FROM attendance_logs
       WHERE id = ?`,
      [insertResult.insertId]
    );

    const [latestRows] = await conn.query(`
      SELECT id, username, date, checkin_time, created_at
      FROM attendance_logs
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log("🔥 Inserted row verify:", verifyRows[0] || null);
    console.log("🔥 Latest rows:", latestRows);

    return noStoreJson({
      success: true,
      action: "insert",
      dbInfo,
      today,
      checkinTime,
      queryResult: {
        insertId: insertResult.insertId,
        affectedRows: insertResult.affectedRows,
        warningStatus: insertResult.warningStatus,
      },
      insertedRow: verifyRows[0] || null,
      latestRows,
    });
  } catch (error) {
    console.error("❌ CHECKIN API ERROR:", error);

    return noStoreJson(
      {
        success: false,
        error: error.message,
        code: error.code || null,
        sqlMessage: error.sqlMessage || null,
      },
      500
    );
  }
}