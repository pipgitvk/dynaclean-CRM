// app/components/task/UpcomingLeads.jsx
import { getDbConnection } from "@/lib/db";
import TaskTable from "./TaskTable";
import UpcomingLeadsCards from "./UpcomingLeadsCards";
import { Suspense } from "react";
import Link from "next/link";

export default async function UpcomingLeads({ leadSource, userRole = "" }) {
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

  const [newStatusRows] = await connection.execute(
    `
    SELECT COUNT(*) as count
    FROM customers c
    WHERE (c.lead_source = ? OR c.sales_representative = ? OR c.assigned_to = ?)
      AND TRIM(LOWER(c.status)) = 'new'
    `,
    [leadSource, leadSource, leadSource]
  );

  const newStatusCount = newStatusRows[0]?.count || 0;

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
        <div className="flex items-center gap-3">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700">
            Upcoming Enquiry
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-600">New Leads</span>
            <Link href="/sales-dashboard/customers?status=New" className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-red-500 px-3 text-base font-bold text-white shadow transition hover:bg-red-600">
              {newStatusCount}
            </Link>
          </div>
        </div>
      </div>



      

      <div className="relative  overflow-hidden break-words  ">
        <Suspense
          fallback={<div className="flex gap-4 py-5">Loading cards...</div>}
        >
          <UpcomingLeadsCards leadSource={leadSource} userRole={userRole} />
        </Suspense>
      </div>
      <TaskTable tasks={Tablerows} userRole={userRole} />
    </div>
  );
}
