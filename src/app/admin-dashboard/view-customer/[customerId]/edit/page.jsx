import { getDbConnection } from "@/lib/db";
import EditCustomerForm from "@/components/customer/EditCustomerForm";
import UpdateLeadSourceForm from "@/components/customer/UpdateLeadSourceForm";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }) {
  const { customerId } = await params;

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT customer_id, first_name, email, tags, status, phone, lead_source, stage, company, address
     FROM customers WHERE customer_id = ?`,
    [customerId]
  );

  const [leadSourceRows] = await conn.execute(
    `SELECT DISTINCT lead_source FROM customers`
  );
  // await conn.end();

  if (!rows.length) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center text-red-600 font-semibold">
        Customer not found.
      </div>
    );
  }

  const leadSources = leadSourceRows.map((row) => row.lead_source);

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-lg text-gray-700">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-700">
        Edit Customere #{customerId}
      </h1>
      <UpdateLeadSourceForm initialData={rows[0]} leadSources={leadSources} />
      <EditCustomerForm initialData={rows[0]} />
    </div>
  );
}
