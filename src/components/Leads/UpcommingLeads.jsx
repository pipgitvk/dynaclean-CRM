// app/components/task/UpcomingLeads.jsx
import { getDbConnection } from "@/lib/db";
import TaskTable from "./TaskTable";
import UpcomingLeadsCards from "./UpcomingLeadsCards";
import { Suspense } from "react";

export default async function UpcomingLeads({ leadSource }) {
  const connection = await getDbConnection();

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
          WHERE (c.lead_source = ? OR c.sales_representative = ? OR c.assigned_to = ?)
            AND c.status != 'DENIED'
          ORDER BY cf.next_followup_date ASC
    `,
    [leadSource, leadSource, leadSource]
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
