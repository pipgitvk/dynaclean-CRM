import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import TLFollowupForm from "@/components/TL/TLFollowupForm";
import { redirect } from "next/navigation";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

export default async function TLFollowupPage({ params }) {
  const payload = await getSessionPayload();
  if (!payload) {
    redirect("/login");
  }

  const paramsResolved = await params;
  const { customerId } = paramsResolved;
  const conn = await getDbConnection();

  // Fetch customer details
  const [customers] = await conn.execute(
    `SELECT 
      c.*,
      cf.next_followup_date as latest_next_followup,
      cf.followed_date as latest_followed_date,
      cf.notes as latest_notes,
      cf.followed_by as latest_followed_by
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, next_followup_date, followed_date, notes, followed_by,
      ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY time_stamp DESC) as rn
      FROM customers_followup
    ) cf ON c.customer_id = cf.customer_id AND cf.rn = 1
    WHERE c.customer_id = ?`,
    [customerId]
  );

  if (customers.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center text-red-600 font-semibold">
        Customer not found.
      </div>
    );
  }

  const customer = customers[0];

  // Fetch latest TL followup
  const [tlFollowups] = await conn.execute(
    `SELECT * FROM TL_followups WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
    [customerId]
  );

  const latestTLFollowup = tlFollowups[0] || null;

  return (
    <div className="max-w-4xl mx-auto mt-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        TL Follow-up Entry
      </h1>

      {/* Customer Info Card */}
      <div className="bg-white shadow-lg rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
          Customer Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
          <div>
            <p className="mb-2">
              <strong>Customer ID:</strong> {customer.customer_id}
            </p>
            <p className="mb-2">
              <strong>Name:</strong> {customer.first_name} {customer.last_name}
            </p>
            <p className="mb-2">
              <strong>Company:</strong> {customer.company}
            </p>
            <p className="mb-2">
              <strong>Phone:</strong> {customer.phone}
            </p>
          </div>
          <div>
            <p className="mb-2">
              <strong>Email:</strong> {customer.email}
            </p>
            <p className="mb-2">
              <strong>Status:</strong>{" "}
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                {customer.status || "N/A"}
              </span>
            </p>
            <p className="mb-2">
              <strong>Assigned To:</strong> {customer.lead_source || "Unassigned"}
            </p>
            <p className="mb-2">
              <strong>Products Interest:</strong> {customer.products_interest}
            </p>
          </div>
        </div>

        {/* Latest Employee Follow-up Info */}
        {customer.latest_followed_date && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Latest Employee Follow-up</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
              <p>
                <strong>Last Called:</strong>{" "}
                {dayjs(customer.latest_followed_date).format("DD MMM YYYY, hh:mm A")}
              </p>
              <p>
                <strong>By:</strong> {customer.latest_followed_by}
              </p>
              <p className="md:col-span-2">
                <strong>Notes:</strong> {customer.latest_notes || "No notes"}
              </p>
            </div>
          </div>
        )}

        {/* Latest TL Follow-up Info */}
        {latestTLFollowup && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Latest TL Follow-up</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
              <p>
                <strong>Date:</strong>{" "}
                {dayjs(latestTLFollowup.followed_date).format("DD MMM YYYY, hh:mm A")}
              </p>
              <p>
                <strong>Quality Score:</strong>{" "}
                {latestTLFollowup.lead_quality_score
                  ? `${latestTLFollowup.lead_quality_score}/10`
                  : "N/A"}
              </p>
              <p>
                <strong>Status:</strong> {latestTLFollowup.status || "N/A"}
              </p>
              <p>
                <strong>Tags:</strong> {latestTLFollowup.multi_tag || "N/A"}
              </p>
              <p className="md:col-span-2">
                <strong>TL Notes:</strong> {latestTLFollowup.notes || "No notes"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Follow-up Form */}
      <TLFollowupForm 
        customerId={customerId} 
        customerData={customer}
        isAdmin={false}
        currentStage={latestTLFollowup?.stage || "New"}
      />
    </div>
  );
}
