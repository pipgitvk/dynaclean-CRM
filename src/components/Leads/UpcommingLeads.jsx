// app/components/task/UpcomingLeads.jsx
import { getDbConnection } from "@/lib/db";
import TaskTable from "./TaskTable";
import UpcomingLeadsCards from "./UpcomingLeadsCards";
import { Suspense } from "react";

export default async function UpcomingLeads({ leadSource }) {
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

  console.log("Fetching table rows for leadSource:", leadSource);
  console.log("Calculated 'sixHoursAhead':", sixHoursAhead);

  const [Tablerows] = await connection.execute(
    `
    SELECT cf.*, c.status, c.stage, c.company, c.customer_id, c.first_name, c.phone, c.products_interest
          FROM customers c
          LEFT JOIN customers_followup cf 
              ON cf.customer_id = c.customer_id
              AND cf.time_stamp = (
                  SELECT MAX(time_stamp) 
                  FROM customers_followup 
                  WHERE customer_id = c.customer_id
              )
          WHERE c.lead_source = ?
            AND c.status != 'DENIED'
          ORDER BY cf.next_followup_date ASC
    `,
    [leadSource]
  );

  return (
    <div
      // style={{ paddingRight: "5rem" }}
      className="bg-white lg:p-6 rounded-xl shadow-md mx-auto mt-2 "
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700">
          Upcoming Enquiry
        </h2>
      </div>

      <div className="relative  overflow-hidden break-words  ">
        <Suspense
          fallback={<div className="flex gap-4 py-5">Loading cards...</div>}
        >
          <UpcomingLeadsCards leadSource={leadSource} />
        </Suspense>
      </div>
      <TaskTable tasks={Tablerows} />
    </div>
  );
}
