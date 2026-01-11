// app/components/Leads/UpcomingTeamLeaderFollowups.jsx
import { getDbConnection } from "@/lib/db";
import UpcomingTeamLeaderFollowupsCards from "./UpcomingTeamLeaderFollowupsCards";
import { Suspense } from "react";

export default async function UpcomingTeamLeaderFollowups({ teamLeader }) {
  const connection = await getDbConnection();
  
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
  const sixHoursAhead = new Date(istNow.getTime() + 6 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");


  const [TableRows] = await connection.execute(
    `
    SELECT 
      c.customer_id,
      c.first_name,
      c.last_name,
      c.phone,
      c.company,
      c.products_interest,
      c.status,
      c.stage,
      c.lead_source,
      tlf.id as tl_followup_id,
      tlf.estimated_order_date,
      tlf.lead_quality_score,
      tlf.multi_tag,
      tlf.notes as tl_notes,
      tlf.next_followup_date,
      tlf.followed_date,
      tlf.created_at,
      tlf.assigned_employee
    FROM customers c
    INNER JOIN TL_followups tlf ON c.customer_id = tlf.customer_id
    WHERE tlf.followed_by = ?
      AND c.status != 'DENIED'
      AND tlf.id = (
        SELECT MAX(id) 
        FROM TL_followups 
        WHERE customer_id = c.customer_id
      )
    ORDER BY tlf.next_followup_date ASC, tlf.created_at DESC
    `,
    [teamLeader]
  );

  return (
    <div className="bg-white lg:p-6 rounded-xl shadow-md mx-auto mt-2">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700">
          Upcoming Team Leader Followups
        </h2>
      </div>


      <div className="relative overflow-hidden break-words">
        <Suspense
          fallback={<div className="flex gap-4 py-5">Loading TL followup cards...</div>}
        >
          <UpcomingTeamLeaderFollowupsCards teamLeader={teamLeader} />
        </Suspense>
      </div>
    </div>
  );
}
