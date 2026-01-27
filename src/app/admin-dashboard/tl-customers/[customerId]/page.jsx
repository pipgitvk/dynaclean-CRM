import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import dayjs from "dayjs";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  Building,
  Calendar,
  User,
  Target,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Plus,
  Eye,
  Edit,
  MessageSquare,
  Users,
  BarChart3,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminTLCustomerDetailPage({ params }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return <div className="p-8 text-red-600">Unauthorized</div>;
  }

  const { customerId } = await params;
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/quotations-show?customer_id=${encodeURIComponent(customerId)}`,
    { cache: "no-store" }, // important for server-side fresh data
  );

  console.log("quotation response status:", res.status);

  let latestquote = null;

  if (res.ok) {
    latestquote = await res.json();
    console.log("latestquote data:", latestquote);
  } else {
    console.error("Failed to fetch quotation");
  }

  const conn = await getDbConnection();

  // Fetch customer details
  const [customers] = await conn.execute(
    `SELECT * FROM customers WHERE customer_id = ?`,
    [customerId],
  );

  if (customers.length === 0) {
    return <div className="p-8 text-red-600">Customer not found</div>;
  }

  const customer = customers[0];

  // Fetch employee followups
  const [empFollowups] = await conn.execute(
    `SELECT * FROM customers_followup WHERE customer_id = ? ORDER BY time_stamp DESC`,
    [customerId],
  );

  // Fetch TL followups
  const [tlFollowups] = await conn.execute(
    `SELECT * FROM TL_followups WHERE customer_id = ? ORDER BY created_at DESC`,
    [customerId],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link
          href="/admin-dashboard/tl-customers"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to TL Customers
        </Link>

        {/* Customer Overview Card */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-4">
          <div className="flex items-start gap-4 mb-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">
                {customer.first_name} {customer.last_name}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                <span className="flex items-center gap-1">
                  <Building className="w-3 h-3" />
                  {customer.company}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {dayjs(customer.date_created).format("MMM DD, YYYY")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  customer.status === "Active"
                    ? "bg-green-100 text-green-800"
                    : customer.status === "Pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : customer.status === "Inactive"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-blue-100 text-blue-800"
                }`}
              >
                {customer.status}
              </span>
              <Link
                href={`/admin-dashboard/tl-customers/${customerId}/followup`}
                className="group relative p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200"
                title="Add TL Follow-up"
              >
                <Plus className="w-4 h-4" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  Add TL Follow-up
                </span>
              </Link>
              <Link
                href={`/admin-dashboard/view-customer/${customerId}`}
                className="group relative p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
                title="View Profile"
              >
                <Eye className="w-4 h-4" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  View Profile
                </span>
              </Link>
              <Link
                href={`/admin-dashboard/view-customer/${customerId}/edit`}
                className="group relative p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all duration-200"
                title="Edit Customer"
              >
                <Edit className="w-4 h-4" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  Edit Customer
                </span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500 mb-0.5">Customer ID</p>
              <p className="font-semibold text-gray-800 truncate">
                {customer.customer_id}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone
              </p>
              <p className="font-semibold text-gray-800 truncate">
                {customer.phone}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </p>
              <p className="font-semibold text-gray-800 truncate">
                {customer.email}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                <Target className="w-3 h-3" /> Products
              </p>
              <p className="font-semibold text-gray-800 truncate">
                {customer.products_interest || "Not specified"}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                <User className="w-3 h-3" /> Assigned
              </p>
              <p className="font-semibold text-gray-800 truncate">
                {customer.lead_source || "Unassigned"}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Follow-ups
              </p>
              <p className="font-semibold text-gray-800">
                {empFollowups.length} | {tlFollowups.length}
              </p>
            </div>
          </div>
        </div>

        {/* Follow-up Activity Timeline */}
        <div className="bg-white shadow-md rounded-lg border border-gray-200 p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Follow-up Activity Timeline
          </h2>

          {tlFollowups.length === 0 && empFollowups.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No follow-ups yet</p>
              <p className="text-gray-400 text-xs">
                Start tracking customer interactions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Combined and sorted follow-ups */}
              {[
                ...tlFollowups.map((f) => ({ ...f, followupType: "TL" })),
                ...empFollowups.map((f) => ({
                  ...f,
                  followupType: "Employee",
                })),
              ]
                .sort(
                  (a, b) =>
                    new Date(b.time_stamp || b.created_at) -
                    new Date(a.time_stamp || a.created_at),
                )
                .map((followup, index) => {
                  const isTLFollowup = followup.followupType === "TL";
                  const isEmployeeFollowup =
                    followup.followupType === "Employee";

                  return (
                    <div
                      key={`${isTLFollowup ? "tl" : "emp"}-${index}`}
                      className="relative"
                    >
                      {/* Timeline line */}
                      {index < [...tlFollowups, ...empFollowups].length - 1 && (
                        <div className="absolute left-3 top-8 w-0.5 h-full bg-gray-200 -z-10"></div>
                      )}

                      <div className="flex gap-3">
                        {/* Timeline dot */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isTLFollowup ? "bg-blue-600" : "bg-green-600"
                          }`}
                        >
                          {isTLFollowup ? (
                            <Users className="w-3 h-3 text-white" />
                          ) : (
                            <User className="w-3 h-3 text-white" />
                          )}
                        </div>

                        {/* Follow-up content */}
                        <div className="flex-1 bg-gray-50 rounded p-3 border border-gray-200">
                          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                isTLFollowup
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {isTLFollowup ? "TL" : "Emp"}
                            </span>
                            <span className="text-gray-500">
                              {dayjs(
                                followup.time_stamp || followup.created_at,
                              ).format("MMM DD, YYYY • hh:mm A")}
                            </span>
                            <span className="text-gray-600">
                              <strong>By:</strong> {followup.followed_by}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                            {followup.status && (
                              <div className="bg-white rounded p-1.5">
                                <span className="text-gray-500">Status:</span>
                                <p className="text-gray-800 font-medium">
                                  {followup.status}
                                </p>
                              </div>
                            )}
                            {followup.lead_quality_score && (
                              <div className="bg-white rounded p-1.5">
                                <span className="text-gray-500">Score:</span>
                                <p className="text-gray-800 font-medium">
                                  {followup.lead_quality_score}/10
                                </p>
                              </div>
                            )}
                            {followup.multi_tag && (
                              <div className="bg-white rounded p-1.5">
                                <span className="text-gray-500">Tags:</span>
                                <p className="text-gray-800 font-medium truncate">
                                  {followup.multi_tag}
                                </p>
                              </div>
                            )}
                            {followup.comm_mode && (
                              <div className="bg-white rounded p-1.5">
                                <span className="text-gray-500">Mode:</span>
                                <p className="text-gray-800 font-medium">
                                  {followup.comm_mode}
                                </p>
                              </div>
                            )}
                            {followup.next_followup_date && (
                              <div className="bg-orange-50 rounded p-1.5 border border-orange-200">
                                <span className="text-gray-500">Next:</span>
                                <p className="text-orange-800 font-medium flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {dayjs(followup.next_followup_date).format(
                                    "MMM DD, HH:mm",
                                  )}
                                </p>
                              </div>
                            )}
                            {followup.estimated_order_date && (
                              <div className="bg-yellow-50 rounded p-1.5 border border-yellow-200">
                                <span className="text-gray-500">
                                  Est. Order:
                                </span>
                                <p className="text-yellow-800 font-medium flex items-center gap-1">
                                  <Target className="w-3 h-3" />
                                  {dayjs(followup.estimated_order_date).format(
                                    "MMM DD",
                                  )}
                                </p>
                              </div>
                            )}
                            {latestquote?.length > 0 && (
                              <Link
                                href={`/admin-dashboard/quotations/${latestquote[0].quote_number}`}
                                className="block"
                              >
                                <div className="bg-green-50 rounded p-1.5 border border-green-200 hover:bg-green-100 transition cursor-pointer">
                                  <span className="text-gray-500">
                                    Latest Quotation:
                                  </span>

                                  <p className="text-green-800 font-medium flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    {dayjs(latestquote[0].quote_date).format(
                                      "MMM DD",
                                    )}
                                  </p>
                                </div>
                              </Link>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                            <span className="text-gray-600">
                              <strong>Notes:</strong>{" "}
                              {followup.notes || "No notes"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
