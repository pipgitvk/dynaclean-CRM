// components/service/UpcomingFollowupsWidget.jsx
// Future scheduled follow-ups (next_followup_date > NOW)
import { getDbConnection } from "@/lib/db";
import UpcomingFollowupsClient from "./UpcomingFollowupsClient";

export default async function UpcomingFollowupsWidget({ username, userRole }) {
  const connection = await getDbConnection();
  const role = (userRole || "").toUpperCase();
  const canViewAll = role === "SERVICE HEAD" || role === "SUPERADMIN" || role === "DIRECTOR";

  let rows;

  if (canViewAll) {
    [rows] = await connection.execute(
      `SELECT mf.*
       FROM machines_followup mf
       INNER JOIN (
         SELECT serial_number, MAX(id) AS max_id
         FROM machines_followup
         GROUP BY serial_number
       ) latest ON mf.serial_number = latest.serial_number AND mf.id = latest.max_id
       WHERE mf.next_followup_date > NOW()
       ORDER BY mf.next_followup_date ASC
       LIMIT 60`
    );
  } else {
    [rows] = await connection.execute(
      `SELECT mf.*
       FROM machines_followup mf
       INNER JOIN (
         SELECT serial_number, MAX(id) AS max_id
         FROM machines_followup
         WHERE added_by = ?
         GROUP BY serial_number
       ) latest ON mf.serial_number = latest.serial_number AND mf.id = latest.max_id
       WHERE mf.next_followup_date > NOW()
       ORDER BY mf.next_followup_date ASC
       LIMIT 60`,
      [username]
    );
  }

  // Convert Date objects to ISO strings to make them serializable
  const serializedRows = rows.map(row => ({
    ...row,
    followed_at: row.followed_at ? new Date(row.followed_at).toISOString() : null,
    next_followup_date: row.next_followup_date ? new Date(row.next_followup_date).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  }));

  return (
    <UpcomingFollowupsClient
      initialRows={serializedRows}
      username={username}
      userRole={userRole}
    />
  );
}
