"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  UploadCloud,
  FileCheck,
  ClipboardList,
  Search,
  CheckCircle,
  XCircle,
  MoreVertical,
  Truck,
  ArrowUp,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";

import DeleteButton from "@/components/accounts/DeleteButton";
import toast from "react-hot-toast";
import ReturnInitiateMenuItem from "@/components/orders/ReturnInitiateMenuItem";

// 👻 A sleek skeleton loader for a modern feel
const SkeletonLoader = () => (
  <div className="animate-pulse space-y-4">
    {/* Search bar and filter skeleton */}
    <div className="h-10 bg-gray-200 rounded-lg w-full mb-6"></div>

    {/* Desktop table skeleton */}
    <div className="hidden lg:block overflow-x-auto">
      <div className="bg-gray-200 h-12 rounded-t-lg"></div>
      <div className="border border-gray-200 rounded-b-lg p-4 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    </div>

    {/* Mobile card skeleton */}
    <div className="lg:hidden space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-gray-100 border rounded-xl shadow-sm p-4 space-y-2"
        >
          <div className="h-6 bg-gray-200 w-3/4 rounded"></div>
          <div className="h-4 bg-gray-200 w-1/2 rounded"></div>
          <div className="h-4 bg-gray-200 w-2/3 rounded"></div>
        </div>
      ))}
    </div>
  </div>
);

export default function OrderTable({ orders, userRole }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState(""); // '', pendinginvoice, invoiceuploaded, bookingdone, dispatchdone, canceled
  const [paymentTermsFilter, setPaymentTermsFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null); // State to track which menu is open
  // const canShowInstall = ["ADMIN", "SALES", "SERVICE"].includes(userRole);

  const toggleMenu = (id) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  // Filter orders based on search query, status filter, and date range
  useEffect(() => {
    if (!orders) return;

    const lowercasedQuery = searchQuery.toLowerCase();
    const result = orders.filter((order) => {
      // Step 1: Filter by status
      if (statusFilter) {
        const orderStatus = getStatusText(order)
          .text.toLowerCase()
          .replace(/\s+/g, "");
        if (orderStatus !== statusFilter.toLowerCase()) return false;
      }

      // Step 2: Date range filter (created_at)
      if (dateFrom || dateTo) {
        const created = order.created_at ? new Date(order.created_at) : null;
        if (!created || isNaN(created)) return false;
        if (dateFrom) {
          const from = new Date(dateFrom + "T00:00:00");
          if (created < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo + "T23:59:59");
          if (created > to) return false;
        }
      }

      // Step 2.5: Filter by created_by
      if (createdByFilter && order.created_by !== createdByFilter) {
        return false;
      }

      // Step 2.7: Filter by payment_terms
      if (paymentTermsFilter && order.payment_terms !== paymentTermsFilter) {
        return false;
      }

      // Step 3: Search across multiple fields
      return (
        order.order_id?.toLowerCase().includes(lowercasedQuery) ||
        order.client_name?.toLowerCase().includes(lowercasedQuery) ||
        order.company_name?.toLowerCase().includes(lowercasedQuery) ||
        order.contact?.toLowerCase().includes(lowercasedQuery) ||
        order.state?.toLowerCase().includes(lowercasedQuery)
      );
    });
    setFilteredOrders(result);
  }, [searchQuery, orders, statusFilter, paymentTermsFilter, dateFrom, dateTo, createdByFilter]);

  const getStatusText = (order) => {
    // Check for pending approval first
    if (order.approval_status === 'pending') {
      return {
        text: "Order Initiated",
        bg: "bg-yellow-100",
        textCol: "text-yellow-800",
        icon: <FileText size={14} className="mr-1" />,
      };
    }
    if (order.approval_status === 'rejected') {
      return {
        text: "Rejected",
        bg: "bg-red-100",
        textCol: "text-red-800",
        icon: <XCircle size={14} className="mr-1" />,
      };
    }
    // Check for return status (highest priority after pending)
    // Note: is_returned === 3 (Return Initiated) is admin-only and hidden from users
    if (Number(order.is_returned) === 1) {
      // If warehouse_in_done = 1, show "Return Completed"
      if (Number(order.warehouse_in_done) === 1) {
        return {
          text: "Return Completed",
          bg: "bg-teal-100",
          textCol: "text-teal-800",
          icon: <CheckCircle size={14} className="mr-1" />,
        };
      }
      return {
        text: "Fully Returned",
        bg: "bg-red-100",
        textCol: "text-red-800",
        icon: <XCircle size={14} className="mr-1" />,
      };
    }
    if (Number(order.is_returned) === 2) {
      return {
        text: "Partially Returned",
        bg: "bg-orange-100",
        textCol: "text-orange-800",
        icon: <XCircle size={14} className="mr-1" />,
      };
    }
    if (Number(order.is_returned) === 3) {
      if (Number(order.return_booking_done) === 1) {
        return {
          text: "Return Booking Done",
          bg: "bg-indigo-100",
          textCol: "text-indigo-800",
          icon: <ArrowUp size={14} className="mr-1" />,
        };
      }
      return {
        text: "Return Initiated",
        bg: "bg-purple-100",
        textCol: "text-purple-800",
        icon: <ArrowUp size={14} className="mr-1" />,
      };
    }
    if (order.is_cancelled || order.approval_status === 'rejected') {
      return {
        text: "Canceled",
        bg: "bg-red-100",
        textCol: "text-red-800",
        icon: <XCircle size={14} className="mr-1" />,
      };
    }
    if (order.installation_status) {
      return {
        text: "Installed",
        bg: "bg-green-100",
        textCol: "text-green-800",
        icon: <CheckCircle size={14} className="mr-1" />,
      };
    }
    if (order.delivery_status) {
      return {
        text: "Delivered",
        bg: "bg-orange-100",
        textCol: "text-orange-800",
        icon: <Truck size={14} className="mr-1" />,
      };
    }
    if (order.dispatch_status) {
      return {
        text: "Dispatch Done",
        bg: "bg-violet-100",
        textCol: "text-violet-800",
        icon: <FileText size={14} className="mr-1" />,
      };
    }
    if (order.booking_id) {
      return {
        text: "Booking Done",
        bg: "bg-green-100",
        textCol: "text-green-800",
        icon: <FileCheck size={14} className="mr-1" />,
      };
    }
    if (order.report_file) {
      return {
        text: "Invoice Uploaded",
        bg: "bg-blue-100",
        textCol: "text-blue-800",
        icon: <FileText size={14} className="mr-1" />,
      };
    }
    return {
      text: "Pending Invoice",
      bg: "bg-yellow-100",
      textCol: "text-yellow-800",
      icon: <UploadCloud size={14} className="mr-1" />,
    };
  };

  const getPaymentBadge = (paymentStatusRaw) => {
    const s = (paymentStatusRaw || "").toString().trim().toLowerCase();
    const compact = s.replace(/\s+/g, "");
    // Colors per requirement:
    // pending: white, paid: green, partially paid: yellow, over due: red
    if (compact === "paid") {
      return {
        text: "Paid",
        cls: "bg-green-100 text-green-800 border-green-200",
      };
    }
    if (compact === "partiallypaid") {
      return {
        text: "Partially Paid",
        cls: "bg-yellow-100 text-yellow-800 border-yellow-200",
      };
    }
    if (compact === "overdue" || compact === "overdue") {
      return {
        text: "Over Due",
        cls: "bg-red-100 text-red-800 border-red-200",
      };
    }
    // default pending
    return {
      text: s ? paymentStatusRaw : "Pending",
      cls: "bg-white text-gray-700 border-gray-300",
    };
  };

  // const getInstallationLabel = (installationStatus) => {
  //   const done = Number(installationStatus) === 1;
  //   return done ? { text: "Installed", cls: "text-green-700" } : { text: "Pending", cls: "text-gray-600" };
  // };

  const formatCompanyName = (name) => {
    const text = String(name || "").trim();
    if (!text) return "";
    const words = text.split(/\s+/);
    if (words.length <= 3) return text;
    const first = words.slice(0, 3).join(" ");
    const rest = words.slice(3).join(" ");
    return (
      <span className="inline-block text-left break-words max-w-full">
        {first}
        <br />
        {rest}
      </span>
    );
  };

  if (!orders) {
    return <SkeletonLoader />;
  }

  if (orders.length === 0)
    return <p className="text-gray-600">No orders submitted yet.</p>;

  return (
    <div className="space-y-6">
      {/* 🔍 Search and Quick Status Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-2/3">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by ID, client, company, etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ease-in-out"
          />
        </div>
      </div>

      {/* 🧰 Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="orderinitialized">Order Initiated</option>
            <option value="pendinginvoice">Pending Invoice</option>
            <option value="invoiceuploaded">Invoice Uploaded</option>
            <option value="bookingdone">Booking Done</option>
            <option value="dispatchdone">Dispatch Done</option>
            <option value="delivered">Delivered</option>
            <option value="installed">Installed</option>
            <option value="canceled">Canceled</option>
            <option value="returninitiated">Return Initiated</option>
            <option value="returnbookingdone">Return Booking Done</option>
            <option value="partiallyreturned">Partially Returned</option>
            <option value="fullyreturned">Fully Returned</option>
            <option value="returncompleted">Return Completed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Created By</label>
          <select
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Users</option>
            {[...new Set(orders?.map((o) => o.created_by).filter(Boolean))]
              .sort()
              .map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Payment Terms</label>
          <select
            value={paymentTermsFilter}
            onChange={(e) => setPaymentTermsFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Terms</option>
            {[...new Set(orders?.map((o) => o.payment_terms).filter(Boolean))]
              .sort()
              .map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* 👨‍💼 TABLE VIEW for large screens */}
      <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] bg-white rounded-xl shadow-lg">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-gray-800 text-white sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 font-semibold text-center">#</th>
              <th className="px-3 py-3 font-semibold text-left">Order ID</th>
              <th className="px-3 py-3 font-semibold text-left">Created By</th>
              <th className="px-3 py-3 font-semibold text-left">Order Date</th>
              <th className="px-3 py-3 font-semibold text-left">Company</th>
              <th className="px-3 py-3 font-semibold text-left">Item</th>
              <th className="px-3 py-3 font-semibold text-left">Payment Terms</th>
              <th className="px-3 py-3 font-semibold text-center">Status</th>
              <th className="px-3 py-3 font-semibold text-center">Payment</th>
              <th className="px-3 py-3 font-semibold text-center">Due Date</th>
              {/* {canShowInstall && (
                <th className="px-3 py-3 font-semibold text-center">Install</th>
              )} */}
              <th className="px-3 py-3 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((r, i) => {
                const status = getStatusText(r);
                const pay = getPaymentBadge(r.payment_status);
                // const inst = getInstallationLabel(r.installation_status);
                return (
                  <tr
                    key={r.order_id}
                    className="hover:bg-gray-50 text-center transition-colors duration-150"
                  >
                    <td className="px-3 py-3">{i + 1}</td>
                    <td className="px-3 py-3 font-medium text-gray-800">
                      {r.order_id}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-800">
                      {r.created_by}
                    </td>
                    <td className="px-3 py-3 text-left">
                      {dayjs(r.created_at).format("DD/MM/YYYY")}
                    </td>
                    <td className="px-3 py-3 text-left">
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-semibold">Client:</span>{" "}
                          {r.client_name}
                        </div>
                        <div>
                          <span className="font-semibold">Company:</span>{" "}
                          {formatCompanyName(r.company_name)}
                        </div>
                        <div>
                          <span className="font-semibold">Contact:</span>{" "}
                          {r.contact}
                        </div>
                        <div>
                          <span className="font-semibold">Location:</span>{" "}
                          {r.state}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-left">
                      <div className="space-y-1 text-xs">
                        <div>
                          <span className="font-semibold">Item:</span> {r.item_name}
                        </div>
                        <div>
                          <span className="font-semibold">Modal:</span> {r.item_code}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-left text-sm">
                      {r.payment_terms ? (
                        <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                          {r.payment_terms}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.textCol}`}
                        >
                          {status.icon} {status.text}
                        </span>
                        {r.approval_remark && (
                          <span
                            className="text-xs text-gray-600 max-w-[180px] line-clamp-2 block text-left"
                            title={r.approval_remark}
                          >
                            {r.approval_remark}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${pay.cls}`}
                      >
                        {pay.text}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {dayjs(r.duedate).format("DD/MM/YYYY")}
                    </td>
                    {/* {canShowInstall && (
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-white ${inst.cls}`}>
                          {inst.text}
                        </span>
                      </td>
                    )} */}
                    <td className="px-3 py-3 space-x-2 flex items-center justify-center relative">
                      <ActionButtons
                        r={r}
                        userRole={userRole}
                        isOpen={openMenuId === r.order_id}
                        toggleMenu={() => toggleMenu(r.order_id)}
                      />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 📱 CARD VIEW for mobile */}
      <div className="lg:hidden space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((r, i) => {
            const status = getStatusText(r);
            return (
              <div
                key={r.order_id}
                className="bg-white border border-gray-200 rounded-xl shadow-md p-4 space-y-2 text-sm"
              >
                <div className="flex justify-between items-center text-gray-500">
                  <span className="text-xs">#{i + 1}</span>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-800 mr-2">
                      {dayjs(r.created_at).format("DD/MM/YYYY")}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.textCol}`}
                    >
                      {status.text}
                    </span>
                    <span>
                      <ActionButtons
                        r={r}
                        userRole={userRole}
                        isOpen={openMenuId === r.order_id}
                        toggleMenu={() => toggleMenu(r.order_id)}
                      />
                    </span>
                  </div>
                </div>
                <div>
                  <strong>Order Id:</strong> {r.order_id}
                </div>

                <div>
                  <strong>Client:</strong> {r.client_name}
                </div>
                <div className="whitespace-normal break-words max-w-full">
                  <strong>Company:</strong> {formatCompanyName(r.company_name)}
                </div>
                <div>
                  <strong>Contact:</strong> {r.contact}
                </div>
                <div>
                  <strong>Location:</strong> {r.state}
                </div>
                {r.approval_remark && (
                  <div>
                    <strong>Remark:</strong> {r.approval_remark}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-center text-gray-500">No orders found.</p>
        )}
      </div>
    </div>
  );
}

function ViewReturnBookingMenuItem({ order }) {
  const [open, setOpen] = useState(false);
  const hasReturnBooking = Number(order.return_booking_done) === 1;
  if (!hasReturnBooking) return null;

  const fmtDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return isNaN(date.getTime()) ? String(d) : date.toLocaleDateString("en-IN");
  };

  const url = (order.return_booking_url || "").toString().trim();

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700 text-sm"
      >
        <FileCheck size={16} />
        <span>View Return Booking</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-6 text-center">Return Booking</h1>

              <table className="w-full text-sm border">
                <tbody>
                  {[
                    ["Order ID", order.order_id],
                    ["Return Booking ID", order.return_booking_ref],
                    ["Return Booking Date", fmtDate(order.return_booking_date)],
                    ["Expected Pickup Date", fmtDate(order.expected_pickup_date)],
                    ["Booked By", order.return_booking_by],
                    ["Remarks", order.return_booking_remarks],
                  ].map(([label, value]) => (
                    <tr key={label} className="border">
                      <td className="p-2 font-medium w-1/3 bg-gray-50">{label}</td>
                      <td className="p-2 whitespace-pre-wrap">{value || "-"}</td>
                    </tr>
                  ))}
                  <tr className="border">
                    <td className="p-2 font-medium w-1/3 bg-gray-50">Booking URL</td>
                    <td className="p-2">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline break-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {url}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 🔘 Modular Action Buttons (used in both views)
function ActionButtons({ r, userRole, isOpen, toggleMenu }) {
  if (r.is_cancelled) {
    return null;
  }

  const popRef = useRef(null);
  const role = (userRole || "").toString().trim().toLowerCase();
  const isGem = role.includes("gem");
  const canViewSales = [
    "back office",
    "accountant",
    "admin",
    "sales",
    "warehouse incharge",
    "gem portal",
    "team leader",
    "service head",
  ].includes(role) || isGem;
  const isAdmin = role === "admin";
  const isAccountant = role.includes("accountant");
  const isTeamLeader = role === "team leader";
  const isWarehouse = role === "warehouse incharge";
  const canManageReturns = isAdmin || isAccountant || isTeamLeader;
  const hasBooking =
    r.booking_id !== undefined &&
    r.booking_id !== null &&
    String(r.booking_id).trim() !== "" &&
    String(r.booking_id) !== "0";
  const dispatchStatus = Number(r.dispatch_status);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e) => {
      if (!popRef.current) return;
      // Don't close if clicking on a link, button, or inside any modal dialog
      if (
        e.target.closest("a") ||
        e.target.closest("button") ||
        e.target.closest('[role="dialog"]') ||
        e.target.closest(".fixed.inset-0")
      ) {
        return;
      }
      if (!popRef.current.contains(e.target)) {
        toggleMenu();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, [isOpen, toggleMenu]);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={toggleMenu}
        className="p-2 rounded-full hover:bg-gray-200 transition-colors duration-150"
        title="Show actions"
      >
        <MoreVertical size={18} />
      </button>
      {isOpen && (
        <div
          ref={popRef}
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black/5 z-20 border min-h-[40px]"
        >
          <div className="py-1 text-sm flex flex-col">
            <Link
              href={`/user-dashboard/order/${r.order_id}`}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 w-full block"
              title="View Sales"
              onClick={(e) => e.stopPropagation()}
            >
              <ClipboardList size={16} />
              <span>View Sales</span>
            </Link>
            {!isGem && (
              <>
                {["accountant", "admin", "team leader"].includes(role) &&
                  (r.report_file ? (
                    <Link
                      href={`/user-dashboard/order/view/${r.order_id}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 w-full block"
                      title="View Report"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText size={16} />
                      <span>View Report</span>
                    </Link>
                  ) : (
                    <div className="flex items-center">
                      <Link
                        href={`/user-dashboard/order/upload/${r.order_id}`}
                        className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-yellow-700"
                        title="Upload Report"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <UploadCloud size={16} />
                        <span>Upload Report</span>
                      </Link>
                      <div className="px-2">
                        <DeleteButton orderId={r.order_id} />
                      </div>
                    </div>
                  ))}
                {(canManageReturns) &&
                  (hasBooking ? (
                    <Link
                      href={`/user-dashboard/order/view-booking/${r.order_id}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 w-full block"
                      title="View Booking"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileCheck size={16} />
                      <span>View Booking</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/user-dashboard/order/upload-booking/${r.order_id}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-green-700 w-full block"
                      title="Create Booking"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <UploadCloud size={16} />
                      <span>Create Booking</span>
                    </Link>
                  ))}
                {isWarehouse && hasBooking && dispatchStatus === 0 && (
                  <Link
                    href={`/user-dashboard/order/dispatch/${r.order_id}`}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 w-full block"
                    title="Dispatch"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CheckCircle size={16} />
                    <span>Dispatch</span>
                  </Link>
                )}
                {(isWarehouse || canManageReturns) &&
                  hasBooking &&
                  dispatchStatus === 1 && (
                    <Link
                      href={`/user-dashboard/order/dispatch/view/${r.order_id}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 w-full block"
                      title="View Dispatch"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Search size={16} />
                      <span>View Dispatch</span>
                    </Link>
                  )}
                {["accountant", "admin"].includes(role) && r.report_file && (
                  <div className="px-3 py-2 w-full block" onClick={(e) => e.stopPropagation()}>
                    <EditPaymentButton order={r} />
                  </div>
                )}
                <UpdateDeliveryMenuItem order={r} />
                {canManageReturns &&
                  dispatchStatus === 1 &&
                  ![1, 2, 3].includes(Number(r.is_returned || 0)) && (
                  <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <ReturnInitiateMenuItem
                      order={r}
                      orderListPath="/user-dashboard/order"
                    />
                  </div>
                )}
                {canManageReturns && Number(r.is_returned) === 3 && (
                  <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <ReturnBookingMenuItem order={r} />
                  </div>
                )}
                {isWarehouse && Number(r.is_returned) === 3 && Number(r.return_booking_done) !== 1 && (
                  <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <MarkReturnBookingDoneMenuItem order={r} />
                  </div>
                )}
                {(canManageReturns || isWarehouse) && Number(r.return_booking_done) === 1 && (
                  <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <ViewReturnBookingMenuItem order={r} />
                  </div>
                )}
                {(isAdmin || isAccountant) && [3, 1, 2].includes(Number(r.is_returned)) && r.credit_note_id && (
                  <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/user-dashboard/credit-notes/${r.credit_note_id}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-teal-700 w-full"
                      title="View Credit Note"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText size={16} />
                      <span>View Credit Note</span>
                    </Link>
                  </div>
                )}
                {isWarehouse &&
                  Number(r.is_returned) === 3 &&
                  Number(r.return_booking_done) === 1 &&
                  Number(r.warehouse_in_done) !== 1 && (
                  <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <WarehouseInMenuItem order={r} />
                  </div>
                )}
                {/* After warehouse-in done, show view for admin + accountant + warehouse */}
                {(isAdmin || isAccountant || isWarehouse) && Number(r.warehouse_in_done) === 1 && (
                  <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <WarehouseInMenuItem order={r} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditPaymentButton({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    payment_id: order.payment_id || "",
    payment_date: "",
    payment_amount: "",
    payment_status: order.payment_status || "",
  });
  const [status, setStatus] = useState(order.payment_status || "");
  const totalamt = order.totalamt || 0;

  const prevIds = (order.payment_id || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const prevDates = (order.payment_date || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const prevAmounts = (order.payment_amount || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rows = Array.from({
    length: Math.max(prevIds.length, prevDates.length, prevAmounts.length),
  }).map((_, i) => ({
    id: prevIds[i] || "",
    date: prevDates[i] || "",
    amount: prevAmounts[i] || "",
  }));

  const formatPrevDate = (d) => {
    if (!d) return "-";
    const v = dayjs(d);
    return v.isValid() ? v.format("DD/MM/YYYY") : d;
  };

  const totalPaid = prevAmounts
    .map((x) => Number(x))
    .filter((n) => !isNaN(n))
    .reduce((sum, n) => sum + n, 0);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/orders/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          payment_id: form.payment_id || null,
          payment_date: form.payment_date || null,
          payment_amount:
            form.payment_amount === "" ? null : Number(form.payment_amount),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Save failed");
      setStatus(json.payment_status);
      setForm((prev) => ({ ...prev, payment_status: json.payment_status }));
      setOpen(false);
      // Optionally refresh page/client state here
      router.refresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const isPaid =
    (order.payment_status || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "") === "paid";

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center justify-center px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs"
        title={isPaid ? "View Payment" : "Edit Payment"}
      >
        {isPaid ? "View Payment" : "Edit Payment"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
            <h3 className="font-semibold mb-3">
              {isPaid ? "View Payment" : "Edit Payment"}
            </h3>
            <p>Total Amount : {totalamt}</p>
            <div className="space-y-3">
              <div className="text-xs text-gray-700">
                <div className="font-medium mb-1">Previous Payments</div>
                {rows.length ? (
                  <div className="border rounded">
                    <div className="grid grid-cols-3 text-gray-600 bg-gray-50 px-2 py-1">
                      <div>ID</div>
                      <div>Date</div>
                      <div className="text-right">Amount</div>
                    </div>
                    <div className="max-h-40 overflow-auto">
                      {rows.map((r, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-3 px-2 py-1 border-t"
                        >
                          <div className="truncate" title={r.id}>
                            {r.id || "-"}
                          </div>
                          <div>{formatPrevDate(r.date)}</div>
                          <div className="text-right">{r.amount || "-"}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 px-2 py-1 border-t bg-gray-50">
                      <div className="col-span-2 font-medium">Total Paid</div>
                      <div className="text-right font-semibold">
                        {totalPaid}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No previous payments</div>
                )}
              </div>
              {!isPaid && (
                <>
                  <Input
                    label="Payment ID (UTR No)"
                    name="payment_id"
                    onChange={onChange}
                  />
                  <Input
                    label="Payment Date"
                    name="payment_date"
                    type="date"
                    onChange={onChange}
                  />
                  <Input
                    label="Payment Amount"
                    name="payment_amount"
                    type="number"
                    onChange={onChange}
                  />
                </>
              )}
              <div className="text-sm text-gray-600">
                Status:{" "}
                <span className="font-medium">
                  {form.payment_status || "-"}
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded border"
              >
                {isPaid ? "Close" : "Cancel"}
              </button>
              {!isPaid && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-3 py-1 rounded bg-purple-600 text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Input({ label, name, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className="w-full border rounded px-2 py-1 text-sm"
      />
    </div>
  );
}

function UpdateDeliveryMenuItem({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [deliveredOn, setDeliveredOn] = useState("");
  const [deliveryProof, setDeliveryProof] = useState(null);
  const [deliveryRemark, setDeliveryRemark] = useState("");
  const [uploading, setUploading] = useState(false);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.username);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Check if menu item should be shown
  const shouldShow = () => {
    // Only show if dispatch_status is 1
    if (Number(order.dispatch_status) !== 1) return false;

    // Only show if current user is the booking_by person
    if (!currentUser || order.booking_by !== currentUser) return false;

    return true;
  };

  const isDelivered = Number(order.delivery_status) === 1;

  const handleSave = async () => {
    if (!deliveredOn) {
      alert("Please select delivery date");
      return;
    }

    try {
      setSaving(true);
      let deliveryProofUrl = null;

      // Upload delivery proof if file is selected
      if (deliveryProof) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", deliveryProof);

        const uploadRes = await fetch("/api/upload-delivery-proof", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload delivery proof");
        }

        const uploadJson = await uploadRes.json();
        deliveryProofUrl = uploadJson.url;
        setUploading(false);
      }

      const res = await fetch("/api/orders/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          delivered_on: deliveredOn,
          delivery_proof: deliveryProofUrl,
          delivery_remark: deliveryRemark,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update delivery status");
      }

      alert("Delivery status updated successfully!");
      setOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update delivery status");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (!shouldShow()) return null;

  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return isNaN(date) ? d : date.toLocaleDateString("en-IN");
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-blue-700 text-left"
        title={isDelivered ? "View Delivery" : "Update Delivery Status"}
      >
        <Truck size={16} />
        <span>{isDelivered ? "View Delivery" : "Update Delivery"}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              {isDelivered ? "Delivery Details" : "Update Delivery Status"}
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  Order ID:{" "}
                  <span className="font-medium text-gray-800">
                    {order.order_id}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Client:{" "}
                  <span className="font-medium text-gray-800">
                    {order.client_name}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Expected Delivery Date:
                </label>
                <p className="text-sm font-medium text-gray-800">
                  {formatDate(order.delivery_date)}
                </p>
              </div>

              {isDelivered ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Actual Delivery Date:
                    </label>
                    <p className="text-sm font-medium text-gray-800">
                      {formatDate(order.delivered_on)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Proof:
                    </label>
                    {order.delivery_proof ? (
                      <div className="flex gap-3">
                        <a
                          href={order.delivery_proof}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium transition"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          View
                        </a>
                        <a
                          href={order.delivery_proof}
                          download
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium transition"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Download
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No delivery proof uploaded
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Remark:
                    </label>
                    {order.delivery_remark ? (
                      <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">
                        {order.delivery_remark}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No remark provided
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Actual Delivery Date *
                    </label>
                    <input
                      type="date"
                      value={deliveredOn}
                      onChange={(e) => setDeliveredOn(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Proof (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setDeliveryProof(e.target.files[0])}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {deliveryProof && (
                      <p className="text-xs text-gray-600 mt-1">
                        Selected: {deliveryProof.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Remark (Optional)
                    </label>
                    <textarea
                      value={deliveryRemark}
                      onChange={(e) => setDeliveryRemark(e.target.value)}
                      placeholder="Enter any remarks about the delivery..."
                      maxLength="500"
                      rows="3"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {deliveryRemark.length}/500 characters
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                {isDelivered ? "Close" : "Cancel"}
              </button>
              {!isDelivered && (
                <button
                  onClick={handleSave}
                  disabled={saving || uploading}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {uploading
                    ? "Uploading..."
                    : saving
                      ? "Saving..."
                      : "Mark as Delivered"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MarkReturnBookingDoneMenuItem({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    // Fetch current user
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.username);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();

    // Set current date
    const today = new Date().toISOString().split("T")[0];
    setCurrentDate(today);
  }, []);

  // Show only if status is "Return Initiated" and not already marked as done
  const shouldShow = () => {
    if (Number(order.is_returned) !== 3) return false;
    if (Number(order.return_booking_done) === 1) return false;
    return true;
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!image) {
      setError("Please upload an image (mandatory)");
      return;
    }

    setSubmitting(true);
    try {
      // Upload image
      const formData = new FormData();
      formData.append("file", image);

      const uploadRes = await fetch("/api/upload-return-booking-image", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      const uploadJson = await uploadRes.json();
      const imageUrl = uploadJson.url;

      // Mark as return booking done
      const res = await fetch("/api/orders/mark-return-booking-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          return_booking_date: currentDate,
          return_booking_image: imageUrl,
          return_booking_by: currentUser,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("✅ Return booking marked as done!");
        setTimeout(() => {
          setOpen(false);
          setSuccess("");
          setImage(null);
          setImagePreview(null);
          router.refresh(); // Refresh page data in background
        }, 1500);
      } else {
        setError(json.error || "Failed to mark return booking as done.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!shouldShow()) return null;

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-green-700 text-sm"
      >
        <CheckCircle size={16} />
        <span>Mark Return Booking Done</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-center">Mark Return Booking Done</h2>

              {/* Order info */}
              <div className="space-y-3 mb-6 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Order ID:</span>
                  <span className="text-gray-800 ml-2">{order.order_id}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Client Name:</span>
                  <span className="text-gray-800 ml-2">{order.client_name}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Current Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={currentDate}
                    readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Today's date</p>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Image *
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {image && (
                    <p className="text-xs text-gray-600 mt-1">
                      ✓ Selected: {image.name}
                    </p>
                  )}
                </div>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                    <p className="text-xs text-gray-600 mb-2">Preview:</p>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded"
                    />
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
                    {success}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setImage(null);
                      setImagePreview(null);
                      setError("");
                    }}
                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !image}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {submitting ? "Submitting..." : "Mark as Done"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ReturnBookingMenuItem({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    return_booking_id: "",
    return_booking_date: "",
    expected_pickup_date: "",
    return_booking_url: "",
    return_booking_remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasReturnBooking = Number(order.return_booking_done) === 1;
  if (hasReturnBooking) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/return-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          return_booking_id: formData.return_booking_id,
          return_booking_date: formData.return_booking_date,
          expected_pickup_date: formData.expected_pickup_date,
          return_booking_url: formData.return_booking_url,
          return_booking_remarks: formData.return_booking_remarks,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess("✅ Return booking created successfully!");
        setTimeout(() => {
          setOpen(false);
          setSuccess("");
          setFormData({ return_booking_id: "", return_booking_date: "", expected_pickup_date: "", return_booking_url: "", return_booking_remarks: "" });
          router.refresh();
        }, 1500);
      } else {
        setError(json.error || "Failed to create return booking.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-blue-700 text-sm"
      >
        <UploadCloud size={16} />
        <span>Return Booking</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-6 text-center">Return Booking</h1>

              {/* Order info table */}
              <table className="w-full mb-6 text-sm border">
                <tbody>
                  {[
                    ["Order ID", order.order_id],
                    ["Client Name", order.client_name],
                    ["Contact", order.contact],
                    ["Email", order.email],
                    ["Delivery Location", order.delivery_location],
                    ["Client Delivery Date", order.client_delivery_date
                      ? new Date(order.client_delivery_date).toLocaleDateString("en-IN")
                      : "-"],
                  ].map(([label, value]) => (
                    <tr key={label} className="border">
                      <td className="p-2 font-medium w-1/3 bg-gray-50">{label}</td>
                      <td className="p-2">{value || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  name="return_booking_id"
                  value={formData.return_booking_id}
                  onChange={handleChange}
                  required
                  placeholder="Return Booking ID"
                  className="w-full border px-3 py-2 rounded-md"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Return Booking Date
                  </label>
                  <input
                    type="date"
                    name="return_booking_date"
                    value={formData.return_booking_date}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full border px-3 py-2 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Expected Pickup Date
                  </label>
                  <input
                    type="date"
                    name="expected_pickup_date"
                    value={formData.expected_pickup_date}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full border px-3 py-2 rounded-md"
                  />
                </div>

                <input
                  type="text"
                  name="return_booking_url"
                  value={formData.return_booking_url}
                  onChange={handleChange}
                  placeholder="Booking URL (optional)"
                  className="w-full border px-3 py-2 rounded-md"
                />

                <textarea
                  name="return_booking_remarks"
                  value={formData.return_booking_remarks}
                  onChange={handleChange}
                  placeholder="Remark *"
                  required
                  className="w-full border px-3 py-2 rounded-md"
                  rows={3}
                />

                {error && <p className="text-red-600 font-bold">{error}</p>}
                {success && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md font-bold">
                    {success}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {submitting ? "Uploading..." : "Upload Booking"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WarehouseInMenuItem({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const today = new Date().toLocaleDateString("en-CA");

  const isDone = Number(order.warehouse_in_done) === 1;

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!image) {
      setError("Image upload karna mandatory hai.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("order_id", order.order_id);
      fd.append("warehouse_in_date", today);
      fd.append("image", image);

      const res = await fetch("/api/orders/warehouse-in", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save");

      setSuccess("✅ Warehouse-In done! Stock updated.");
      setTimeout(() => {
        setOpen(false);
        setSuccess("");
        setImage(null);
        setImagePreview(null);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-IN");
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-sm ${isDone ? "text-blue-700" : "text-green-700"}`}
      >
        {isDone ? <FileCheck size={16} /> : <CheckCircle size={16} />}
        <span>{isDone ? "View Warehouse-In" : "Warehouse-In"}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              <h2 className="text-xl font-bold text-center text-gray-800">
                {isDone ? "View Warehouse-In" : "Warehouse-In"}
              </h2>

              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div><span className="font-medium text-gray-600">Order ID:</span> <span className="text-gray-800 ml-1">{order.order_id}</span></div>
                <div><span className="font-medium text-gray-600">Client:</span> <span className="text-gray-800 ml-1">{order.client_name}</span></div>
              </div>

              {isDone ? (
                /* ── VIEW MODE ── */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Date</p>
                      <p className="font-medium text-gray-800">{fmtDate(order.warehouse_in_date)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Done By</p>
                      <p className="font-medium text-gray-800">{order.warehouse_in_by || "-"}</p>
                    </div>
                  </div>

                  {/* Image */}
                  {order.warehouse_in_image ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Proof Image</p>
                      <div className="relative rounded-lg overflow-hidden border border-gray-200 group">
                        <img
                          src={order.warehouse_in_image}
                          alt="Warehouse-In proof"
                          className="w-full h-52 object-cover"
                        />
                        <a
                          href={order.warehouse_in_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all"
                        >
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Full Image
                          </span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No image uploaded</p>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              ) : (
                /* ── SUBMIT MODE ── */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={today}
                      readOnly
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image Upload <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    {image && <p className="text-xs text-green-700 mt-1">✓ {image.name}</p>}
                  </div>

                  {imagePreview && (
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <img src={imagePreview} alt="Preview" className="w-full h-44 object-cover" />
                    </div>
                  )}

                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                  {success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 font-medium">{success}</p>}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => { setOpen(false); setImage(null); setImagePreview(null); setError(""); }}
                      className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !image}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      {submitting ? "Saving..." : "Submit"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
