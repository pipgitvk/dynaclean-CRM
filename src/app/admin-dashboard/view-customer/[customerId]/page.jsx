// app/user-dashboard/view-customer/[customerId]/page.tsx
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureCustomersFollowupNotesText } from "@/lib/ensureCustomersFollowupNotesText";
import dayjs from "dayjs";
import FollowUpHistory from "@/components/Leads/FollowUpHistory";
import CustomerContactsModal from "@/components/Customers/CustomerContactsModal";
import CustomerContactHierarchyList from "@/components/Customers/CustomerContactHierarchyList";
import ViewCustomerQuotationsLink from "@/components/Customers/ViewCustomerQuotationsLink";
import CustomerWhatsAppLink from "@/components/Customers/CustomerWhatsAppLink";
import CustomerPerformaInvoiceButton from "@/components/invoice/CustomerPerformaInvoiceButton";
import ScheduleVisitModal from "@/components/scheduleVisit/ScheduleVisitModal";
import { canShowScheduleVisitOnCustomerProfile } from "@/lib/scheduleVisitScope";
import { userHasModuleKey } from "@/lib/userModuleAccessServer";
import Link from "next/link";
import axios from "axios";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isDashboardEmbedPage, withEmbedQuery } from "@/lib/dashboardEmbed";
import { customerPartyLedgerHref } from "@/lib/customerPartyLedger";
import {
  collectHierarchyCustomerIds,
  fetchCustomerFollowupHistory,
} from "@/lib/customerHierarchyFollowups";
import {
  customerOrderMatchParams,
  sqlCustomerOrderBelongsToCustomer,
} from "@/lib/customerOrderScope";

export default async function CustomerPage({ params, searchParams }) {
  const { customerId } = await params;
  const isEmbed = isDashboardEmbedPage(
    await searchParams,
    await headers(),
  );
  const dashHref = (path) => (isEmbed ? withEmbedQuery(path) : path);
  const conn = await getDbConnection();
  await ensureCustomersFollowupNotesText(conn);

  // Fetch current user info
  const payload = await getSessionPayload();
  const userRole = payload?.role || "";
  const username = payload?.username || "";
  const showScheduleVisitBtn = canShowScheduleVisitOnCustomerProfile(userRole);

  // Explicitly select all columns including service_lead_source
  const [custs] = await conn.execute(
    `SELECT c.customer_id, c.first_name, c.last_name, c.email, c.phone, c.company, c.address, c.gstin, c.tags, c.status, c.stage, c.lead_source, c.assigned_to, c.service_lead_source, c.lead_campaign, c.date_created, c.notes, c.parent_customer_id,
      p.customer_id AS parent_id,
      CONCAT(TRIM(p.first_name), ' ', TRIM(COALESCE(p.last_name, ''))) AS parent_name,
      p.phone AS parent_phone,
      p.company AS parent_company
     FROM customers c
     LEFT JOIN customers p ON c.parent_customer_id = p.customer_id
     WHERE c.customer_id = ?`,
    [customerId],
  );
  const customer = custs[0] || {};
  // Log to verify we're getting service_lead_source
  console.log("View customer page - customer data:", customer);
  if (!customer) {
    notFound();
  }

  const customerDisplayName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  // Fetch child contacts (members under this customer)
  const [childContacts] = await conn.execute(
    `SELECT customer_id, first_name, last_name, phone 
     FROM customers 
     WHERE parent_customer_id = ?
     ORDER BY first_name ASC`,
    [customerId],
  );
  console.log(`[View Customer] Fetched ${childContacts?.length || 0} child contacts for customer ${customerId}:`, childContacts);

  // Also fetch parent and siblings if this customer has a parent
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
    
    // Fetch siblings (other children of the same parent)
    const [siblingRows] = await conn.execute(
      `SELECT customer_id, first_name, last_name, phone
       FROM customers
       WHERE parent_customer_id = ? AND customer_id != ?
       ORDER BY first_name ASC`,
      [selfData.parent_customer_id, customerId],
    );
    siblingContacts = siblingRows || [];
    console.log(`[View Customer] Customer ${customerId} has parent ${selfData.parent_customer_id}, ${siblingContacts.length} siblings`);
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

  // Fetch orders count for this customer
  // SUPERADMIN/DIRECTOR: see all orders for customer
  // Assigned user (assigned_to) or lead_source = username: also see all orders for customer
  // Others: only their own orders (created_by = username)
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
      // Optional external service — page must still render if API is down or returns an error
    }
  }

  // Fetch machine follow-up history for SUPERADMIN and SALES roles only
  const roleUpper = String(userRole).toUpperCase().trim();
  const canSeeMachineFollowup =
    roleUpper === "SUPERADMIN" ||
    roleUpper === "SALES" ||
    roleUpper === "SALES HEAD" ||
    roleUpper === "SALES CUM BACKOFFICE";

  // await conn.end();

  return (
    <div
      className={
        isEmbed
          ? "mx-auto w-full min-w-0 max-w-full text-gray-700 px-1 py-1"
          : "mx-auto text-gray-700 px-4 py-8"
      }
    >
      {!isEmbed ? (
        <h1 className="text-2xl font-semibold mb-6">
          {customer.first_name || "Unnamed"} (ID: {customer.customer_id})
        </h1>
      ) : null}

      <div className="grid grid-cols-1 gap-8 mb-8">
        {/* Customer Details Block */}
        <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-3">
            Customer Details
          </h2>
    <div
      className={`w-full min-w-0 flex flex-col gap-6 ${
        isEmbed ? "" : "lg:flex-row lg:gap-10"
      }`}
    >

  {/* LEFT SIDE – Customer Details */}
  <div className={`w-full min-w-0 ${isEmbed ? "" : "lg:w-[60%]"}`}>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">

      {/* Row 1 */}
      <div>
        <dt className="text-sm font-medium text-gray-500">Email</dt>
        <dd className="mt-1 text-gray-800 break-words">
          {customer.email || "-"}
        </dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-gray-500">Phone</dt>
        <dd className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-blue-600 font-medium">
            {customer.phone || "-"}
          </span>
          {customer.phone ? (
            <CustomerWhatsAppLink phone={customer.phone} />
          ) : null}
        </dd>
      </div>

      {/* Row 2 */}
      <div>
        <dt className="text-sm font-medium text-gray-500">
          Product Interested
        </dt>
        <dd className="mt-1 text-gray-800 font-semibold">
          {customer.products_interest || "-"}
        </dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-gray-500">Company</dt>
        <dd className="mt-1 text-gray-800">
          {customer.company || "-"}
        </dd>
      </div>

      {/* Row 3 */}
      <div>
        <dt className="text-sm font-medium text-gray-500">Tags</dt>
        <dd className="mt-1 text-gray-800">
          {customer.tags || "-"}
        </dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-gray-500">Status</dt>
        <dd className="mt-1 text-gray-800">
          {customer.status || "-"}
        </dd>
      </div>

      {/* Row 4 */}
      <div>
        <dt className="text-sm font-medium text-gray-500">Lead Source</dt>
        <dd className="mt-1 text-gray-800">
          {customer.lead_source || "-"}
        </dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-gray-500">Service Lead Source</dt>
        <dd className="mt-1 text-gray-800">
          {customer.service_lead_source || "-"}
        </dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-gray-500">
          Lead Campaign
        </dt>
        <dd className="mt-1 text-gray-800">
          {customer.lead_campaign || "-"}
        </dd>
      </div>

      {/* Row 5 - Parent (for Add Contact / member customers) */}
      {customer.parent_id && (
        <>
          <div>
            <dt className="text-sm font-medium text-gray-500">Parent Customer</dt>
            <dd className="mt-1 text-gray-800">
              <Link
                href={dashHref(
                  `/admin-dashboard/view-customer/${customer.parent_id}`,
                )}
                className="text-blue-600 hover:text-blue-800 font-medium underline"
              >
                {customer.parent_name?.trim() || "—"} (ID: {customer.parent_id})
              </Link>
            </dd>
          </div>
          {customer.parent_phone && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Parent Phone</dt>
              <dd className="mt-1 text-gray-800">{customer.parent_phone}</dd>
            </div>
          )}
        </>
      )}

      <div>
        <dt className="text-sm font-medium text-gray-500">Address</dt>
        <dd className="mt-1 text-gray-800 break-words">
          {customer.address || "-"}
        </dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-gray-500">GSTIN</dt>
        <dd className="mt-1 text-gray-800 break-words">
          {customer.gstin?.trim() ? customer.gstin : "-"}
        </dd>
      </div>

      <div>
        <dt className="text-sm font-medium text-gray-500">Created</dt>
        <dd className="mt-1 text-gray-800">
          {customer.date_created
            ? dayjs(customer.date_created).format("DD-MM-YYYY")
            : "-"}
        </dd>
      </div>

      {/* Full-width Notes */}
      <div className="sm:col-span-2">
        <dt className="text-sm font-medium text-gray-500">Notes</dt>
        <dd className="mt-1 text-gray-800 break-words">
          {customer.notes || "-"}
        </dd>
      </div>

    </dl>
  </div>

  {/* RIGHT SIDE – Suggestion Summary */}
  <div className={`w-full min-w-0 ${isEmbed ? "" : "lg:w-[40%]"}`}>
    <div className=" p-2 rounded-xl  h-fit">
      
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
       Suggestion Summary
      </h3>

      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
        {cust_analysis_external?.next_suggestion_summary || "No summary available."}
      </p>

    </div>

     <div className=" p-2 rounded-xl  h-fit">
      
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
       Suggestion Transcription
      </h3>

      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
        {cust_analysis_external?.next_suggestion_transcription || "No transcription available."}
      </p>

    </div>

    {/* Contact Hierarchy Section */}
    <div className="flex max-h-[min(32rem,70vh)] min-h-0 flex-col rounded-xl p-2">
      <h3 className="mb-3 shrink-0 text-lg font-semibold text-gray-800">
        Contact Hierarchy
      </h3>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1">
        <CustomerContactHierarchyList
          layout="sidebar"
          parentContact={parentContact}
          siblingContacts={siblingContacts}
          childContacts={childContacts}
          currentCustomer={{
            customer_id: customer.customer_id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone,
          }}
          dashboardBase="admin-dashboard"
          userRole={userRole}
        />
      </div>
    </div>
  </div>
  

</div>


         
        </div>

        {/* Actions and Follow-up History Block */}
        <div
          className={`bg-white shadow-lg rounded-lg flex flex-col min-w-0 ${
            isEmbed ? "p-4" : "p-6"
          }`}
        >
          <h2
            className={`font-bold text-gray-800 mb-4 ${
              isEmbed ? "text-lg" : "text-2xl mb-5"
            }`}
          >
            Actions
          </h2>
          <div className="w-full mb-10">
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
              <a
                href={dashHref(
                  `/admin-dashboard/view-customer/${customerId}/follow-up`,
                )}
                className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-green-600 hover:bg-green-700 py-2 px-4 rounded-md text-center transition duration-300"
              >
                Follow-up
              </a>
              <a
                href={dashHref(
                  `/admin-dashboard/view-customer/${customerId}/edit`,
                )}
                className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-yellow-600 hover:bg-yellow-700 py-2 px-4 rounded-md text-center transition duration-300"
              >
                Edit
              </a>
              <a
                href={dashHref(
                  `/admin-dashboard/view-customer/${customerId}/demo`,
                )}
                className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-md text-center transition duration-300"
              >
                Demo Registration
              </a>
              <div className="w-full md:w-auto">
                <CustomerContactsModal
                  customerId={customerId}
                  userRole={userRole}
                />
              </div>
              <ViewCustomerQuotationsLink
                customerId={customerId}
                dashboardBase="admin-dashboard"
                variant="admin"
              />
              <Link
                href={dashHref(
                  `/admin-dashboard/quotations/new?customerId=${customerId}`,
                )}
                className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-amber-900 hover:bg-amber-950 py-2 px-4 rounded-md text-center transition duration-300"
              >
                add Quotation
              </Link>
              {canCreatePerformaInvoice && (
                <CustomerPerformaInvoiceButton
                  quotationNumber={latestQuoteNumber}
                  href={dashHref(
                    `/admin-dashboard/invoices/performa?quotation_number=${encodeURIComponent(latestQuoteNumber)}`,
                  )}
                  className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-violet-700 hover:bg-violet-800 py-2 px-4 rounded-md text-center transition duration-300"
                />
              )}
              <Link
                href={dashHref(
                  `/admin-dashboard/special-pricing/${customerId}`,
                )}
                className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-pink-600 hover:bg-pink-700 py-2 px-4 rounded-md text-center transition duration-300"
              >
                Special Price
              </Link>
              <Link
                href={dashHref(customerPartyLedgerHref(customerId, userRole))}
                className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-indigo-600 hover:bg-indigo-700 py-2 px-4 rounded-md text-center transition duration-300"
              >
                View Ledger
              </Link>
              {showScheduleVisitBtn && (
                <ScheduleVisitModal
                  customerId={customerId}
                  customerName={customerDisplayName}
                  contact={customer.phone}
                  address={customer.address}
                  buttonLabel="Schedule Visit"
                  prefillVisitAddress={false}
                />
              )}
              {orderCount > 0 && (
                <Link
                  href={dashHref(
                    `/admin-dashboard/view-customer/${customerId}/orders`,
                  )}
                  className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-teal-600 hover:bg-teal-700 py-2 px-4 rounded-md text-center transition duration-300"
                >
                  Orders ({orderCount})
                </Link>
              )}
              {canSeeMachineFollowup && (
                <Link
                  href={dashHref(
                    `/admin-dashboard/view-customer/${customerId}/machine-followup`,
                  )}
                  className="btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-purple-600 hover:bg-purple-700 py-2 px-4 rounded-md text-center transition duration-300"
                >
                  Machine Follow-up
                </Link>
              )}
            </div>
          </div>

          <section className="min-w-0 w-full">
            <h2
              className={`font-bold mb-4 ${
                isEmbed ? "text-lg" : "text-2xl"
              }`}
            >
              Follow-up History
            </h2>
            <FollowUpHistory
              entries={fups}
              cust_analysis_external={cust_analysis_external}
              userRole={userRole}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
