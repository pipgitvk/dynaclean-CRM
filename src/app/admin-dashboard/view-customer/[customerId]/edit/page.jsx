import { getDbConnection } from "@/lib/db";
import EditCustomerForm from "@/components/customer/EditCustomerForm";
import UpdateLeadSourceForm from "@/components/customer/UpdateLeadSourceForm";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }) {
  const { customerId } = await params;
  
  const payload = await getSessionPayload();
  const userRole = payload?.role;

  const conn = await getDbConnection();
  // Explicitly select all columns including service_lead_source
  const [rows] = await conn.execute(
    `SELECT customer_id, first_name, email, tags, status, phone, lead_source, service_lead_source, stage, company, address FROM customers WHERE customer_id = ?`,
    [customerId]
  );
  const customerData = rows[0] || {};
  console.log("Edit customer page - initial data:", customerData);

  const [leadSourceRows] = await conn.execute(
    `SELECT DISTINCT lead_source FROM customers`
  );
  // Fetch employees with SERVICE HEAD or SERVICE SUPPORT roles
  let serviceEmployees = [];
  try {
    const [employeeRows] = await conn.execute(
      `SELECT username FROM rep_list WHERE userRole IN ('SERVICE HEAD', 'SERVICE SUPPORT') AND status = 1 ORDER BY username ASC`
    );
    serviceEmployees = employeeRows.map(row => row.username);
  } catch (error) {
    console.error('Error fetching service employees:', error);
  }
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
      <UpdateLeadSourceForm initialData={customerData} leadSources={leadSources} serviceEmployees={serviceEmployees} userRole={userRole} />
      <EditCustomerForm initialData={customerData} userRole={userRole} dashboardBase="admin-dashboard" />
    </div>
  );
}
