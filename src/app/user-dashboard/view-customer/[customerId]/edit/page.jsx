import { getDbConnection } from "@/lib/db";
import EditCustomerForm from "@/components/customer/EditCustomerForm";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }) {
  const { customerId } = await params;

  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT customer_id, first_name, email, tags, status, phone, gstin, stage, company, address
     FROM customers WHERE customer_id = ?`,
    [customerId]
  );
  // await conn.end();

  if (!rows.length) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center text-red-600 font-semibold">
        Customer not found.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-lg text-gray-700">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-700">
        Edit Customer #{customerId}
      </h1>
      <EditCustomerForm initialData={rows[0]} />
    </div>
  );
}
