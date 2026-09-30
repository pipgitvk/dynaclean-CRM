import { getDbConnection } from "@/lib/db";
import { getISTDateString, getISTDateTimeString } from "@/lib/istDateTime";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

const getReverseGeocode = async (lat, lon) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent":
            "DynacleanIndustriesApp/1.0 (contact@dynacleanindustries.com)",
        },
      }
    );

    if (!response.ok) {
      return "Failed to get address";
    }

    const data = await response.json();
    return data.display_name || "Address not found";
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Failed to get address";
  }
};

async function getTodayAttendanceRow(connection, username, todayDate) {
  const [rows] = await connection.execute(
    `SELECT id, checkin_time, checkout_time,
      break_morning_start, break_morning_end,
      break_lunch_start, break_lunch_end,
      break_evening_start, break_evening_end
     FROM attendance_logs
     WHERE username = ? AND date = ?
     LIMIT 1`,
    [username, todayDate]
  );
  return rows[0] || null;
}

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("impersonation_token")?.value ||
      cookieStore.get("token")?.value;

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const body = await req.json();
    const { username, action, status, latitude, longitude } = body;

    const targetUsername = username || payload.username;
    const connection = await getDbConnection();
    const todayDate = getISTDateString();
    const currentDateTime = getISTDateTimeString();

    const existing = await getTodayAttendanceRow(
      connection,
      targetUsername,
      todayDate
    );

    let locationAddress = null;
    if (latitude != null && longitude != null && latitude !== "" && longitude !== "") {
      locationAddress = await getReverseGeocode(latitude, longitude);
    }

    switch (action) {
      case "checkin": {
        if (existing?.checkin_time) {
          return Response.json({
            success: true,
            alreadyCheckedIn: true,
            message: "Already checked in",
          });
        }
        if (
          latitude == null ||
          longitude == null ||
          latitude === "" ||
          longitude === ""
        ) {
          return Response.json(
            { error: "Check-in requires GPS location." },
            { status: 400 }
          );
        }
        await connection.execute(
          `INSERT INTO attendance_logs
            (username, date, checkin_time, checkin_latitude, checkin_longitude, checkin_address, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            checkin_time = IF(checkin_time IS NULL, VALUES(checkin_time), checkin_time),
            checkin_latitude = COALESCE(checkin_latitude, VALUES(checkin_latitude)),
            checkin_longitude = COALESCE(checkin_longitude, VALUES(checkin_longitude)),
            checkin_address = COALESCE(checkin_address, VALUES(checkin_address))`,
          [
            targetUsername,
            todayDate,
            currentDateTime,
            latitude ?? null,
            longitude ?? null,
            locationAddress,
            currentDateTime,
          ]
        );
        break;
      }

      case "checkout": {
        if (!existing?.checkin_time) {
          return Response.json({ error: "Check in first." }, { status: 400 });
        }
        if (existing?.checkout_time) {
          return Response.json({
            success: true,
            alreadyCheckedOut: true,
            message: "Already checked out",
          });
        }
        if (
          latitude == null ||
          longitude == null ||
          latitude === "" ||
          longitude === ""
        ) {
          return Response.json(
            { error: "Checkout requires GPS location." },
            { status: 400 }
          );
        }
        await connection.execute(
          `UPDATE attendance_logs
           SET checkout_time = ?, checkout_latitude = ?, checkout_longitude = ?, checkout_address = ?
           WHERE username = ? AND date = ?`,
          [
            currentDateTime,
            latitude,
            longitude,
            locationAddress,
            targetUsername,
            todayDate,
          ]
        );
        break;
      }

      case "break_morning":
      case "break_lunch":
      case "break_evening": {
        if (!existing?.checkin_time) {
          return Response.json({ error: "Check in first." }, { status: 400 });
        }
        if (existing?.checkout_time) {
          return Response.json({ error: "Already checked out." }, { status: 400 });
        }

        const startCol =
          action === "break_morning"
            ? "break_morning_start"
            : action === "break_lunch"
              ? "break_lunch_start"
              : "break_evening_start";
        const endCol =
          action === "break_morning"
            ? "break_morning_end"
            : action === "break_lunch"
              ? "break_lunch_end"
              : "break_evening_end";

        if (status === "ready") {
          if (action === "break_lunch" && !existing.break_morning_end) {
            return Response.json(
              { error: "Complete tea break before lunch." },
              { status: 400 }
            );
          }
          if (action === "break_evening" && !existing.break_lunch_end) {
            return Response.json(
              { error: "Complete lunch break before evening break." },
              { status: 400 }
            );
          }
          if (existing[startCol]) {
            return Response.json(
              { error: "Break already started." },
              { status: 400 }
            );
          }
          const [result] = await connection.execute(
            `UPDATE attendance_logs SET ${startCol} = ? WHERE username = ? AND date = ?`,
            [currentDateTime, targetUsername, todayDate]
          );
          if (result.affectedRows === 0) {
            return Response.json(
              { error: "Could not start break. Try again." },
              { status: 400 }
            );
          }
        } else if (status === "in_progress") {
          if (!existing[startCol]) {
            return Response.json(
              { error: "Break has not been started." },
              { status: 400 }
            );
          }
          if (existing[endCol]) {
            return Response.json(
              { error: "Break already ended." },
              { status: 400 }
            );
          }
          const [result] = await connection.execute(
            `UPDATE attendance_logs SET ${endCol} = ? WHERE username = ? AND date = ?`,
            [currentDateTime, targetUsername, todayDate]
          );
          if (result.affectedRows === 0) {
            return Response.json(
              { error: "Could not end break. Try again." },
              { status: 400 }
            );
          }
        } else {
          return Response.json(
            { error: "Break is not available to start yet." },
            { status: 400 }
          );
        }
        break;
      }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    return Response.json({ success: true, message: "Action completed successfully" });
  } catch (error) {
    console.error("Error performing attendance action:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
