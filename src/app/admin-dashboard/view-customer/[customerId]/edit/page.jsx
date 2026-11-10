import { getDbConnection } from "@/lib/db";
import EditCustomerForm from "@/components/customer/EditCustomerForm";
import UpdateLeadSourceForm from "@/components/customer/UpdateLeadSourceForm";
import { getSessionPayload } from "@/lib/auth";
import { latestFollowupNotesLanguageSelectSql } from "@/lib/customerFollowupNotesLanguage";
import { ensureCustomerNotesLanguageColumn } from "@/lib/ensureCustomerNotesLanguageColumn";
import { headers } from "next/headers";
import { isDashboardEmbedPage } from "@/lib/dashboardEmbed";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params, searchParams }) {
  const { customerId } = await params;
  const isEmbed = isDashboardEmbedPage(await searchParams, await headers());
  
  const payload = await getSessionPayload();
  const userRole = payload?.role;

  const conn = await getDbConnection();
  await ensureCustomerNotesLanguageColumn(conn);

  const [rows] = await conn.execute(
    `SELECT
      c.customer_id,
      c.first_name,
      c.email,
      c.tags,
      c.status,
      c.phone,
      c.lead_source,
      c.service_lead_source,
      c.gem_lead_source,
      c.stage,
      c.company,
      c.address,
      c.gstin,
      ${latestFollowupNotesLanguageSelectSql}
    FROM customers c
    WHERE c.customer_id = ?`,
    [customerId]
  );
  const customerData = rows[0] || {};
  console.log("Edit customer page - initial data:", customerData);

  const [leadSourceRows] = await conn.execute(
    `SELECT DISTINCT c.lead_source FROM customers c 
     LEFT JOIN rep_list r ON c.lead_source = r.username 
     WHERE c.lead_source IS NOT NULL 
     AND r.status = 1
     UNION
     SELECT username as lead_source FROM rep_list WHERE userRole = 'SALES CUM BACKOFFICE' AND status = 1
     ORDER BY lead_source ASC`
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

  // Fetch GEM employees
  let gemEmployees = [];
  try {
    const [gemEmployeeRows] = await conn.execute(
      `SELECT username FROM rep_list WHERE userRole = 'GEM' AND status = 1 ORDER BY username ASC`
    );
    gemEmployees = gemEmployeeRows.map(row => row.username);
  } catch (error) {
    console.error('Error fetching GEM employees:', error);
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
    <div
      className={
        isEmbed
          ? "max-w-xl mx-auto mt-0 p-4 bg-white shadow-md rounded-lg text-gray-700"
          : "max-w-xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-lg text-gray-700"
      }
    >
      {!isEmbed ? (
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-700">
          Edit Customere #{customerId}
        </h1>
      ) : null}
      <UpdateLeadSourceForm initialData={customerData} leadSources={leadSources} serviceEmployees={serviceEmployees} gemEmployees={gemEmployees} userRole={userRole} />
      <EditCustomerForm initialData={customerData} userRole={userRole} dashboardBase="admin-dashboard" />
    </div>
  );
}
