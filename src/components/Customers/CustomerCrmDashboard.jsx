import Link from "next/link";
import dayjs from "dayjs";
import {
  Activity,
  Building2,
  Calendar,
  Clock,
  Layers,
  Lightbulb,
  Mail,
  MapPin,
  Megaphone,
  Mic,
  Package,
  Pencil,
  Phone,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import CustomerCrmFollowUpTable from "@/components/Customers/CustomerCrmFollowUpTable";
import CustomerCrmQuickActions from "@/components/Customers/CustomerCrmQuickActions";
import CustomerContactHierarchyList from "@/components/Customers/CustomerContactHierarchyList";
import ViewCustomerQuotationsLink from "@/components/Customers/ViewCustomerQuotationsLink";
import CustomerWhatsAppLink from "@/components/Customers/CustomerWhatsAppLink";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";

function DetailValue({ className, children }) {
  return <div className={className}>{children ?? "—"}</div>;
}

function DetailIconField({
  icon: Icon,
  label,
  children,
  iconWrapClassName = "bg-violet-100 text-violet-600",
}) {
  return (
    <div className="flex gap-3 p-4">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrapClassName}`}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900">{label}</p>
        <DetailValue className="mt-1 text-sm text-gray-700">{children}</DetailValue>
      </div>
    </div>
  );
}

function CustomerStatusPill({ status }) {
  const label = status?.trim() || "—";
  if (!status?.trim()) {
    return <span className="text-gray-500">—</span>;
  }
  const key = label.toLowerCase();
  let styles = {
    bg: "bg-violet-100",
    dot: "bg-violet-500",
    text: "text-violet-900",
  };
  const isDenied = key.includes("denied") || key.includes("lost");
  if (isDenied || key === "poor") {
    styles = { bg: "bg-rose-100", dot: "bg-rose-500", text: "text-rose-900" };
  } else if (key.includes("new") || key.includes("very") || key.includes("good")) {
    styles = { bg: "bg-emerald-100", dot: "bg-emerald-500", text: "text-emerald-900" };
  } else if (key.includes("average") || key.includes("pending")) {
    styles = { bg: "bg-amber-100", dot: "bg-amber-500", text: "text-amber-900" };
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-black/5 ${styles.bg} ${styles.text}`}
    >
      {isDenied ? (
        <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      ) : (
        <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
      )}
      {label}
    </span>
  );
}

export default function CustomerCrmDashboard({
  customer,
  customerId,
  customerDisplayName,
  fups,
  cust_analysis_external,
  parentContact,
  siblingContacts,
  childContacts,
  userRole,
  orderCount,
  latestQuoteNumber,
  canCreatePerformaInvoice,
  showScheduleVisitBtn,
  canSeeMachineFollowup = false,
  latestNextFollowupDate = null,
}) {
  const mapQuery = encodeURIComponent(customer.address?.trim() || "India");
  const mapSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;

  return (
    <div className="-mx-2 -mt-2 w-[calc(100%+1rem)] max-w-none bg-gradient-to-br from-slate-100 via-gray-100 to-violet-100/70 px-1 pb-2 pt-0 sm:-mx-3 sm:-mt-3 sm:w-[calc(100%+1.5rem)] sm:px-2 sm:pb-3 md:-mx-4 md:-mt-4 md:w-[calc(100%+2rem)]">
      <div className="w-full max-w-none space-y-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-violet-200 text-2xl font-bold text-violet-800 ring-2 ring-violet-300">
                {(customer.first_name?.[0] || "C").toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                  {customerDisplayName || customer.first_name || "Customer"}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CustomerStatusPill status={customer.status} />
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-200">
                    ID: {customer.customer_id}
                  </span>
                  {latestNextFollowupDate ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      Next follow-up:{" "}
                      {formatCrmDatetimeForISTDisplay(
                        latestNextFollowupDate,
                        "DD-MM-YYYY hh:mm A",
                      )}
                    </span>
                  ) : null}
                </div>
                {customer.company ? (
                  <p className="mt-1.5 text-xs text-gray-500">{customer.company}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin-dashboard/view-customer/${customerId}/follow-up`}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-700 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-violet-700"
            >
              <Phone className="h-4 w-4" />
              Follow-up
            </Link>
            <Link
              href={`/admin-dashboard/view-customer/${customerId}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-700 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
            <ViewCustomerQuotationsLink
              customerId={customerId}
              dashboardBase="admin-dashboard"
              variant="admin"
              className="!border !border-slate-700 !bg-slate-600 !text-white shadow hover:!bg-slate-700 !rounded-xl !font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/40 shadow lg:col-span-4">
            <div className="flex items-center justify-between border-b border-violet-200 bg-violet-200/90 px-4 py-3 text-violet-950">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4 text-violet-700" />
                Customer Details
              </span>
              <Link
                href={`/admin-dashboard/view-customer/${customerId}/edit`}
                className="rounded-lg border border-violet-300 bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-200"
              >
                Edit
              </Link>
            </div>
            <div className="divide-y divide-violet-100/90">
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-violet-100/90">
                <DetailIconField icon={Mail} label="Email">
                  {customer.email || "—"}
                </DetailIconField>
                <DetailIconField icon={Phone} label="Phone">
                  <span className="flex flex-wrap items-center gap-2">
                    {customer.phone || "—"}
                    {customer.phone ? <CustomerWhatsAppLink phone={customer.phone} /> : null}
                  </span>
                </DetailIconField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-violet-100/90">
                <DetailIconField icon={Package} label="Product Interested">
                  {customer.products_interest || "—"}
                </DetailIconField>
                <DetailIconField icon={Building2} label="Company">
                  {customer.company || "—"}
                </DetailIconField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-violet-100/90">
                <DetailIconField icon={Tag} label="Tags">
                  {customer.tags || "—"}
                </DetailIconField>
                <DetailIconField icon={Activity} label="Status">
                  <CustomerStatusPill status={customer.status} />
                </DetailIconField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x sm:divide-violet-100/90">
                <DetailIconField icon={Layers} label="Lead Source">
                  {customer.lead_source || "—"}
                </DetailIconField>
                <DetailIconField icon={Megaphone} label="Lead Campaign">
                  {customer.lead_campaign || "—"}
                </DetailIconField>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/40 shadow lg:col-span-4">
            <div className="flex items-center gap-2 border-b border-sky-200 bg-sky-200/90 px-4 py-3 text-sm font-semibold text-sky-950">
              <MapPin className="h-4 w-4 text-sky-700" />
              Address &amp; More
            </div>
            <div className="divide-y divide-sky-100/90">
              <DetailIconField
                icon={Phone}
                label="Service Lead Source"
                iconWrapClassName="bg-sky-100 text-sky-600"
              >
                {customer.service_lead_source || "—"}
              </DetailIconField>
              <DetailIconField
                icon={Building2}
                label="Address"
                iconWrapClassName="bg-sky-100 text-sky-600"
              >
                <span className="break-words">{customer.address || "—"}</span>
              </DetailIconField>
              <DetailIconField
                icon={Calendar}
                label="Created On"
                iconWrapClassName="bg-sky-100 text-sky-600"
              >
                {customer.date_created
                  ? dayjs(customer.date_created).format("DD MMM YYYY, hh:mm A")
                  : "—"}
              </DetailIconField>
            </div>
            <div className="border-t border-sky-100 p-4">
              <div className="overflow-hidden rounded-xl border border-sky-200">
                <iframe
                  title="Customer location"
                  src={mapSrc}
                  className="h-36 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-sky-200 py-2 text-center text-xs font-semibold text-sky-900 hover:bg-sky-300"
                >
                  View Map
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-violet-200 bg-violet-100 p-4 shadow">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-950">
                <Lightbulb className="h-4 w-4 text-violet-600" />
                Suggestion Summary
              </div>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
                {cust_analysis_external?.next_suggestion_summary || "No summary available."}
              </p>
            </div>

            <div className="rounded-2xl border border-teal-200 bg-teal-100 p-4 shadow">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-950">
                <Mic className="h-4 w-4 text-teal-600" />
                Suggestion Transcription
              </div>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
                {cust_analysis_external?.next_suggestion_transcription || "No transcription available."}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-100 p-4 shadow">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-950">
                <Users className="h-4 w-4" />
                Contact Hierarchy
              </div>
              <div className="max-h-64 overflow-y-auto pr-1">
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

        <CustomerCrmQuickActions
          customerId={customerId}
          customerDisplayName={customerDisplayName}
          customerPhone={customer.phone}
          customerAddress={customer.address}
          userRole={userRole}
          orderCount={orderCount}
          latestQuoteNumber={latestQuoteNumber}
          canCreatePerformaInvoice={canCreatePerformaInvoice}
          showScheduleVisitBtn={showScheduleVisitBtn}
          canSeeMachineFollowup={canSeeMachineFollowup}
        />

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow">
          <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-100/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Clock className="h-5 w-5 text-violet-500" />
              Follow-up History
            </h2>
            <span className="flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800">
              <Calendar className="h-4 w-4" />
              Last 6 Months
            </span>
          </div>
          <div className="p-4 sm:p-6">
            <CustomerCrmFollowUpTable
              entries={fups}
              userRole={userRole}
              defaultCustomerId={customer.customer_id}
              defaultCustomerName={customerDisplayName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}