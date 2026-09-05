// app/components/task/UpcomingLeads.jsx
import { getDbConnection } from "@/lib/db";
import TaskTable from "./TaskTable";
import UpcomingLeadsCards from "./UpcomingLeadsCards";
import { Suspense } from "react";
import Link from "next/link";

export default async function UpcomingLeads({
  leadSource,
  userRole = "",
  compact = false,
  variant = "default",
  dashboardPrefix = "/user-dashboard",
}) {
  const connection = await getDbConnection();

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

  // Table rows query - different for Service Support
  const isServiceSupport = userRole === "SERVICE SUPPORT";
  let Tablerows = [];

  if (isServiceSupport) {
    // SERVICE SUPPORT: filter by service_lead_source
    [Tablerows] = await connection.execute(
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
      WHERE c.service_lead_source = ?
        AND c.status != 'DENIED'
      ORDER BY cf.service_next_followup ASC
      `,
      [leadSource]
    );
  } else {
    // All other roles: filter by lead_source
    [Tablerows] = await connection.execute(
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
  }

  const isSales = variant === "sales";
  const shellClass = isSales
    ? "flex h-full flex-col"
    : compact
      ? ""
      : "bg-white rounded-xl shadow-md p-5 mx-auto mt-2";

  return (
    <div className={shellClass}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2
          className={
            variant === "sales"
              ? "text-base font-bold text-violet-700"
              : compact
                ? "text-base font-semibold text-slate-800"
                : "text-2xl font-bold text-violet-700"
          }
        >
          Upcoming Enquiry
        </h2>
        <div className="flex items-center gap-2">
          {variant === "sales" ? (
            <Link
              href={`${dashboardPrefix}/customers?status=New`}
              className="inline-flex items-center gap-2 transition hover:opacity-80"
            >
              <span className="text-sm font-medium text-violet-600">
                New Leads
              </span>
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-violet-600 px-1.5 text-xs font-bold text-white">
                {newStatusCount}
              </span>
            </Link>
          ) : compact ? (
            <>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-bold text-violet-700">
                ({newStatusCount})
              </span>
              <span className="text-sm font-medium text-slate-500">
                New Leads
              </span>
            </>
          ) : (
            <>
              <span className="text-base font-medium text-gray-600">
                New Leads
              </span>
              <Link
                href={`${dashboardPrefix}/customers?status=New`}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-violet-600 px-2.5 text-sm font-bold text-white shadow transition hover:bg-violet-700"
              >
                {newStatusCount}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden break-words">
        <Suspense
          fallback={<div className="flex gap-4 py-5">Loading cards...</div>}
        >
          <UpcomingLeadsCards
            leadSource={leadSource}
            userRole={userRole}
            compact={compact}
            variant={variant}
            dashboardPrefix={dashboardPrefix}
          />
        </Suspense>
      </div>
      {!compact && <TaskTable tasks={Tablerows} userRole={userRole} />}
    </div>
  );
}
