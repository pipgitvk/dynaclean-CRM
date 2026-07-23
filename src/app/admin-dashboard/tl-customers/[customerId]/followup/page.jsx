import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import TLFollowupForm from "@/components/TL/TLFollowupForm";
import FollowupNotesWithDelete from "@/components/TL/FollowupNotesWithDelete";
import TLFollowupClient from "./TLFollowupClient";
import { redirect } from "next/navigation";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

export default async function AdminTLFollowupPage({ params }) {
  const payload = await getSessionPayload();
  if (!payload) {
    redirect("/login");
  }

  const paramsResolved = await params;
  const { customerId } = paramsResolved;
  const conn = await getDbConnection();

  // Ensure model column exists in TL_followups (auto-migration)
  try {
    await conn.execute(
      `ALTER TABLE TL_followups ADD COLUMN model VARCHAR(255) NULL`
    );
  } catch (e) {
    if (e.errno !== 1060) throw e; // 1060 = Duplicate column name (already exists)
  }

  // Fetch customer details
  const [customers] = await conn.execute(
    `SELECT 
      c.*,
      cf.next_followup_date as latest_next_followup,
      cf.followed_date as latest_followed_date,
      cf.notes as latest_notes,
      cf.followed_by as latest_followed_by,
      cf.time_stamp as latest_emp_followup_time_stamp
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, next_followup_date, followed_date, notes, followed_by, time_stamp,
      ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY time_stamp DESC) as rn
      FROM customers_followup
    ) cf ON c.customer_id = cf.customer_id AND cf.rn = 1
    WHERE c.customer_id = ?`,
    [customerId],
  );

  if (customers.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center text-red-600 font-semibold">
        Customer not found.
      </div>
    );
  }

  const customer = customers[0];

  const latestEmpFollowupTimeStampStr =
    customer.latest_emp_followup_time_stamp == null
      ? null
      : typeof customer.latest_emp_followup_time_stamp === "string"
        ? customer.latest_emp_followup_time_stamp
        : dayjs(customer.latest_emp_followup_time_stamp).format(
            "YYYY-MM-DD HH:mm:ss"
          );

  // Fetch latest TL followup
  const [tlFollowups] = await conn.execute(
    `SELECT * FROM TL_followups WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
    [customerId],
  );

  const latestTLFollowup = tlFollowups[0] || null;

  return (
    <TLFollowupClient 
      customerId={customerId}
      customer={customer}
      latestEmpFollowupTimeStampStr={latestEmpFollowupTimeStampStr}
      latestTLFollowup={latestTLFollowup}
    />
  );
}
