import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureCustomersFollowupNotesText } from "@/lib/ensureCustomersFollowupNotesText";
import { notFound } from "next/navigation";
import axios from "axios";
import { canShowScheduleVisitOnCustomerProfile } from "@/lib/scheduleVisitScope";
import { userHasModuleKey } from "@/lib/userModuleAccessServer";
import CustomerCrmDashboard from "@/components/Customers/CustomerCrmDashboard";
import {
  collectHierarchyCustomerIds,
  fetchCustomerFollowupHistory,
} from "@/lib/customerHierarchyFollowups";
import { pickLatestNextFollowupDate } from "@/lib/customerFollowupDisplay";
import {
  customerOrderMatchParams,
  sqlCustomerOrderBelongsToCustomer,
} from "@/lib/customerOrderScope";

export const dynamic = "force-dynamic";

export default async function AdminCustomerCrmPage({ params }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const { customerId } = await params;
  const conn = await getDbConnection();
  await ensureCustomersFollowupNotesText(conn);

  const userRole = payload?.role || "";
  const username = payload?.username || "";
  const showScheduleVisitBtn = canShowScheduleVisitOnCustomerProfile(userRole);

  const [custs] = await conn.execute(
    `SELECT c.customer_id, c.first_name, c.last_name, c.email, c.phone, c.company, c.address, c.gstin, c.tags, c.status, c.stage, c.lead_source, c.assigned_to, c.service_lead_source, c.lead_campaign, c.date_created, c.notes, c.parent_customer_id, c.products_interest,
      p.customer_id AS parent_id,
      CONCAT(TRIM(p.first_name), ' ', TRIM(COALESCE(p.last_name, ''))) AS parent_name,
      p.phone AS parent_phone,
      p.company AS parent_company
     FROM customers c
     LEFT JOIN customers p ON c.parent_customer_id = p.customer_id
     WHERE c.customer_id = ?`,
    [customerId],
  );
  const customer = custs[0];
  if (!customer) {
    notFound();
  }

  const customerDisplayName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const [childContacts] = await conn.execute(
    `SELECT customer_id, first_name, last_name, phone 
     FROM customers 
     WHERE parent_customer_id = ?
     ORDER BY first_name ASC`,
    [customerId],
  );

  let parentContact = null;
  let siblingContacts = [];
  const [selfRows] = await conn.execute(
    `SELECT customer_id, first_name, last_name, phone, parent_customer_id
     FROM customers
     WHERE customer_id = ?`,
    [customerId],
  );
  const selfData = selfRows?.[0];
  if (selfData?.parent_customer_id) {
    const [parentRows] = await conn.execute(
      `SELECT customer_id, first_name, last_name, phone
       FROM customers
       WHERE customer_id = ?`,
      [selfData.parent_customer_id],
    );
    parentContact = parentRows?.[0];

    const [siblingRows] = await conn.execute(
      `SELECT customer_id, first_name, last_name, phone
       FROM customers
       WHERE parent_customer_id = ? AND customer_id != ?
       ORDER BY first_name ASC`,
      [selfData.parent_customer_id, customerId],
    );
    siblingContacts = siblingRows || [];
  }

  const hierarchyCustomerIds = collectHierarchyCustomerIds({
    customerId,
    parentContact,
    siblingContacts,
    childContacts,
  });
  const fups = await fetchCustomerFollowupHistory(conn, {
    customerIds: hierarchyCustomerIds,
    userRole,
    username,
  });

  const isPrivilegedRole = ["SUPERADMIN", "DIRECTOR"].includes(String(userRole).toUpperCase());
  const isAssignedOrLeadSourceOwner =
    customer.assigned_to === username || customer.lead_source === username;
  const canSeeAllOrders = isPrivilegedRole || isAssignedOrLeadSourceOwner;
  const orderMatch = sqlCustomerOrderBelongsToCustomer("no", "qr");
  const orderCountQuery = canSeeAllOrders
    ? `SELECT COUNT(DISTINCT no.order_id) AS orderCount
       FROM neworder no
       LEFT JOIN quotations_records qr ON no.quote_number = qr.quote_number
       WHERE ${orderMatch}`
    : `SELECT COUNT(DISTINCT no.order_id) AS orderCount
       FROM neworder no
       LEFT JOIN quotations_records qr ON no.quote_number = qr.quote_number
       WHERE ${orderMatch} AND no.created_by = ?`;
  const orderCountParams = canSeeAllOrders
    ? customerOrderMatchParams(customerId)
    : [...customerOrderMatchParams(customerId), username];
  const [[{ orderCount }]] = await conn.execute(orderCountQuery, orderCountParams);

  let latestQuoteNumber = "";
  try {
    const [quoteRows] = await conn.execute(
      `SELECT quote_number
       FROM quotations_records
       WHERE customer_id = ?
       ORDER BY quote_date DESC, quote_number DESC
       LIMIT 1`,
      [customerId],
    );
    latestQuoteNumber = quoteRows[0]?.quote_number
      ? String(quoteRows[0].quote_number).trim()
      : "";
  } catch {
    latestQuoteNumber = "";
  }

  const canCreatePerformaInvoice = await userHasModuleKey(
    username,
    userRole,
    "performa-invoices",
  );

  let cust_analysis_external = {};
  const phone = customer.phone != null ? String(customer.phone).trim() : "";
  if (phone) {
    const token = "MsvlRZ16sFnrtGcfuZ2Fjk3CIA4Zsm90jPUZFkVqDsI";
    try {
      const result = await axios.get(
        `https://srvr2.dynacleanindustries.com/api/customer-analysis/external/${encodeURIComponent(phone)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        },
      );
      cust_analysis_external = result.data ?? {};
    } catch {
      cust_analysis_external = {};
    }
  }

  const latestNextFollowupDate = pickLatestNextFollowupDate(fups, userRole);

  const roleUpper = String(userRole).toUpperCase().trim();
  const canSeeMachineFollowup =
    roleUpper === "SUPERADMIN" ||
    roleUpper === "SALES" ||
    roleUpper === "SALES HEAD" ||
    roleUpper === "SALES CUM BACKOFFICE";

  return (
    <CustomerCrmDashboard
      customer={customer}
      customerId={customerId}
      customerDisplayName={customerDisplayName}
      fups={fups}
      cust_analysis_external={cust_analysis_external}
      parentContact={parentContact}
      siblingContacts={siblingContacts}
      childContacts={childContacts}
      userRole={userRole}
      orderCount={orderCount}
      latestQuoteNumber={latestQuoteNumber}
      canCreatePerformaInvoice={canCreatePerformaInvoice}
      showScheduleVisitBtn={showScheduleVisitBtn}
      canSeeMachineFollowup={canSeeMachineFollowup}
      latestNextFollowupDate={latestNextFollowupDate}
    />
  );
}