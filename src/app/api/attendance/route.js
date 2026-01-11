// pages/api/attendance.js or src/app/api/attendance/route.js

import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";



const getReverseGeocode = async (lat, lon) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'User-Agent': 'DynacleanIndustriesApp/1.0 (contact@dynacleanindustries.com)'
        }
      }
    );

    // Check if the response was successful before trying to parse
    if (!response.ok) {
      const errorBody = await response.text(); // Read the error body
      console.error('Nominatim API error:', response.status, errorBody);
      return "Failed to get address";
    }

    const data = await response.json();
    return data.display_name || "Address not found";

  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Failed to get address";
  }
};



export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const conn = await getDbConnection();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [rows] = await conn.execute(
      "SELECT * FROM attendance_logs WHERE username = ? AND date = ?",
      [username, today]
    );

    const attendanceLog = rows.length > 0 ? rows[0] : null;

    return NextResponse.json(attendanceLog);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance data" }, { status: 500 });
  } finally {
    // conn.end();
    console.log("Database connection closed.");
    
  }
}

export async function POST(req) {
  const { username, action, latitude, longitude } = await req.json();
  const conn = await getDbConnection();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Variable to store location data if provided
  let locationAddress = null;
  if (latitude && longitude) {
    locationAddress = await getReverseGeocode(latitude, longitude);
  }

  try {
    switch (action) {
      case 'checkin':
        await conn.execute(
          "INSERT INTO attendance_logs (username, date, checkin_time, checkin_latitude, checkin_longitude, checkin_address) VALUES (?, ?, ?, ?, ?, ?)",
          [username, today, now, latitude, longitude, locationAddress]
        );
        break;

      case 'break_morning':
        await conn.execute(
          "UPDATE attendance_logs SET break_morning_start = ? WHERE username = ? AND date = ?",
          [now, username, today]
        );
        break;

      case 'end_morning':
        await conn.execute(
          "UPDATE attendance_logs SET break_morning_end = ? WHERE username = ? AND date = ?",
          [now, username, today]
        );
        break;

      case 'break_lunch':
        await conn.execute(
          "UPDATE attendance_logs SET break_lunch_start = ? WHERE username = ? AND date = ?",
          [now, username, today]
        );
        break;

      case 'end_lunch':
        await conn.execute(
          "UPDATE attendance_logs SET break_lunch_end = ? WHERE username = ? AND date = ?",
          [now, username, today]
        );
        break;

      case 'break_evening':
        await conn.execute(
          "UPDATE attendance_logs SET break_evening_start = ? WHERE username = ? AND date = ?",
          [now, username, today]
        );
        break;

      case 'end_evening':
        await conn.execute(
          "UPDATE attendance_logs SET break_evening_end = ? WHERE username = ? AND date = ?",
          [now, username, today]
        );
        break;

      case 'checkout':
        await conn.execute(
          "UPDATE attendance_logs SET checkout_time = ?, checkout_latitude = ?, checkout_longitude = ?, checkout_address = ? WHERE username = ? AND date = ?",
          [now, latitude, longitude, locationAddress, username, today]
        );
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 });
  } finally {
    // conn.end();
    console.log("Database connection closed.");
    
  }
}