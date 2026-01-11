// app/user-dashboard/view-customer/[customerId]/page.tsx
import { getDbConnection } from "@/lib/db";
import dayjs from "dayjs";
import FollowUpHistory from "@/components/Leads/FollowUpHistory";
import CustomerContactsModal from "@/components/Customers/CustomerContactsModal";

export default async function CustomerPage({ params }) {
  const { customerId } = await params;
  const conn = await getDbConnection();

  // Fetch current user info if needed
  // (e.g., role to conditionally render buttons)

  // Fetch customer
  const [custs] = await conn.execute(
    `SELECT * FROM customers WHERE customer_id = ?`,
    [customerId]
  );
  const customer = custs[0];

  // Fetch followup history
  const [fups] = await conn.execute(
    `SELECT next_followup_date, followed_date, followed_by, notes, comm_mode 
     FROM customers_followup
     WHERE customer_id = ?
     ORDER BY time_stamp DESC`,
    [customerId]
  );

  // await conn.end();

  return (
    <div className="mx-auto text-gray-700 px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">
        {customer.first_name || "Unnamed"} (ID: {customer.customer_id})
      </h1>

      <div className="grid grid-cols-1 gap-8 mb-8">
        {/* Customer Details Block */}
        <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-3">
            Customer Details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-5">
            {/* Row 1 */}
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-gray-800">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-blue-600 font-medium">
                {customer.phone}
              </dd>
            </div>

            {/* Row 2 */}
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Product Interested
              </dt>
              <dd className="mt-1 text-gray-800 font-semibold">
                {customer.products_interest}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Company</dt>
              <dd className="mt-1 text-gray-800">{customer.company}</dd>
            </div>

            {/* Row 3 */}
            <div>
              <dt className="text-sm font-medium text-gray-500">Tags</dt>
              <dd className="mt-1 text-gray-800">{customer.tags}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-gray-800">{customer.status}</dd>
            </div>

            {/* Row 4 */}
            <div>
              <dt className="text-sm font-medium text-gray-500">Lead Source</dt>
              <dd className="mt-1 text-gray-800">{customer.lead_source}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">
                Lead Campaign
              </dt>
              <dd className="mt-1 text-gray-800">{customer.lead_campaign}</dd>
            </div>

            {/* Row 5 */}
            <div>
              <dt className="text-sm font-medium text-gray-500">Address</dt>
              <dd className="mt-1 text-gray-800">{customer.address}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-gray-800">
                {dayjs(customer.date_created).format("DD MMM, YYYY")}
              </dd>
            </div>

            {/* Full-width Notes */}
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Notes</dt>
              <dd className="mt-1 text-gray-800">{customer.notes}</dd>
            </div>
          </dl>
        </div>

        {/* Actions and Follow-up History Block */}
        <div className="bg-white shadow-lg rounded-lg p-6 flex flex-col">
          <h2 className="text-2xl font-bold text-gray-800 mb-5">Actions</h2>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
            <a
              href={`/user-dashboard/view-customer/${customerId}/follow-up`}
              className="btn text-white bg-green-600 hover:bg-green-700 py-2 px-4 rounded-md w-full sm:w-1/3 text-center transition duration-300"
            >
              Follow-up
            </a>
            <a
              href={`/user-dashboard/view-customer/${customerId}/edit`}
              className="btn text-white bg-yellow-600 hover:bg-yellow-700 py-2 px-4 rounded-md w-full sm:w-1/3 text-center transition duration-300"
            >
              Edit
            </a>
            <a
              href={`/user-dashboard/view-customer/${customerId}/demo`}
              className="btn text-white bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-md w-full sm:w-1/3 text-center transition duration-300"
            >
              Demo Registration
            </a>
            <CustomerContactsModal customerId={customerId} />
          </div>

          <section>
            <h2 className="text-2xl font-bold mb-4">Follow-up History</h2>
            <FollowUpHistory entries={fups} />
          </section>
        </div>
      </div>
    </div>
  );
}
