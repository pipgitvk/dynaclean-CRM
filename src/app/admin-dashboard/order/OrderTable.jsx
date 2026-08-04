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
  Trash2,
  ArrowUp,
  ArrowDown,
  PackageCheck,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import dayjs from "dayjs";
import ExcelJS from "exceljs";

import DeleteButton from "@/components/accounts/DeleteButton";
import toast from "react-hot-toast";

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

/** Matches UI status "Dispatch Done" (same rules as getStatusText). */
function isDisplayedDispatchDone(order) {
  if (order.approval_status === "pending") return false;
  if (order.approval_status === "rejected") return false;
  if (order.is_returned === 1) return false;
  if (order.is_returned === 2) return false;
  if (order.is_returned === 3) return false;
  if (order.is_cancelled || order.approval_status === "rejected") return false;
  if (order.installation_status) return false;
  if (order.delivery_status) return false;
  return Boolean(order.dispatch_status);
}

function amountWithoutGst(order) {
  const rawBase = order.baseAmount;
  if (rawBase != null && rawBase !== "") {
    const base = Number(rawBase);
    if (Number.isFinite(base)) return base;
  }
  const total = Number(order.totalamt) || 0;
  const tax = Number(order.taxamt) || 0;
  return Math.max(0, total - tax);
}

/** Calculate total paid amount from comma-separated payment amounts */
function getTotalPaidAmount(order) {
  const paymentAmount = (order.payment_amount || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => !isNaN(n));
  return paymentAmount.reduce((sum, n) => sum + n, 0);
}

/** Calculate total amount - use quotation grand_total as primary source */
function getTotalAmount(order) {
  // First priority: quotation grand_total (from quotations_records)
  const quotationTotal = Number(order.quotation_grand_total) || 0;
  if (quotationTotal > 0) return quotationTotal;
  
  // Second priority: order totalamt
  const total = Number(order.totalamt) || 0;
  if (total > 0) return total;
  
  // Fallback: use baseAmount + taxamt if both are 0
  const base = Number(order.baseAmount) || 0;
  const tax = Number(order.taxamt) || 0;
  return Math.max(total, base + tax);
}

/** Calculate balance amount (total - paid) */
function getBalanceAmount(order) {
  const total = getTotalAmount(order);
  const paid = getTotalPaidAmount(order);
  return Math.max(0, total - paid);
}

/** Sum of quotation line taxable (same as invoice “Taxable” column); fallback base/total−tax. */
function orderTaxableTotal(order) {
  const t = order.order_taxable_total;
  if (t != null && t !== "") {
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return amountWithoutGst(order);
}

/** Get taxable amount for Payment column - use quotation subtotal as primary (₹40,000) */
function getPaymentColumnAmount(order) {
  // First priority: quotation subtotal (taxable amount without GST)
  const quotationSubtotal = Number(order.quotation_subtotal) || 0;
  if (quotationSubtotal > 0) return quotationSubtotal;
  
  // Second priority: use orderTaxableTotal (from quotation items sum)
  return orderTaxableTotal(order);
}

/** Same rules as table filter: `created_at` within optional From/To (order date). */
function orderCreatedInDateRange(order, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const created = order.created_at ? new Date(order.created_at) : null;
  if (!created || isNaN(created.getTime())) return false;
  if (dateFrom) {
    const from = new Date(dateFrom + "T00:00:00");
    if (created < from) return false;
  }
  if (dateTo) {
    const to = new Date(dateTo + "T23:59:59");
    if (created > to) return false;
  }
  return true;
}

export default function OrderTable({ orders, userRole }) {
  // Initialize from localStorage with defaults
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orderTable_searchQuery") || "";
    }
    return "";
  });
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orderTable_statusFilter") || "";
    }
    return "";
  });
  const [dateFrom, setDateFrom] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("orderTable_dateFrom");
      return saved || dayjs().startOf('month').format('YYYY-MM-DD');
    }
    return dayjs().startOf('month').format('YYYY-MM-DD');
  });
  const [dateTo, setDateTo] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("orderTable_dateTo");
      return saved || dayjs().endOf('month').format('YYYY-MM-DD');
    }
    return dayjs().endOf('month').format('YYYY-MM-DD');
  });
  const [createdByFilter, setCreatedByFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orderTable_createdByFilter") || "";
    }
    return "";
  });
  const [openMenuId, setOpenMenuId] = useState(null); // State to track which menu is open
  // const canShowInstall = ["SUPERADMIN"].includes(userRole);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orderTable_approvalStatusFilter") || "";
    }
    return "";
  });
  const [showRejected, setShowRejected] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("orderTable_showRejected");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [showNukePanel, setShowNukePanel] = useState(false);
  const [nukeConfirmText, setNukeConfirmText] = useState("");
  const [nukeLoading, setNukeLoading] = useState(false);
  const [nukeStep, setNukeStep] = useState(1); // 1=confirm dialog, 2=type confirm
  const [taxableClickCount, setTaxableClickCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  // Sorting state
  const [sortColumn, setSortColumn] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");

  // Save filter states to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orderTable_searchQuery", searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orderTable_statusFilter", statusFilter);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orderTable_dateFrom", dateFrom);
    }
  }, [dateFrom]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orderTable_dateTo", dateTo);
    }
  }, [dateTo]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orderTable_createdByFilter", createdByFilter);
    }
  }, [createdByFilter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orderTable_approvalStatusFilter", approvalStatusFilter);
    }
  }, [approvalStatusFilter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("orderTable_showRejected", JSON.stringify(showRejected));
    }
  }, [showRejected]);

  const toggleMenu = (id) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  // Sorting handler
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get value for sorting based on column
  const getSortValue = (order, column) => {
    switch (column) {
      case "order_id":
        return order.order_id?.toString().toLowerCase() || "";
      case "created_by":
        return order.created_by?.toString().toLowerCase() || "";
      case "created_at":
        return order.created_at ? new Date(order.created_at).getTime() : 0;
      case "client_name":
        return order.client_name?.toString().toLowerCase() || "";
      case "company_name":
        return order.company_name?.toString().toLowerCase() || "";
      case "state":
        return order.state?.toString().toLowerCase() || "";
      case "item_name":
        return order.item_name?.toString().toLowerCase() || "";
      case "status":
        return getStatusText(order).text.toLowerCase();
      case "payment_status":
        return order.payment_status?.toString().toLowerCase() || "";
      case "totalamt":
        return Number(order.totalamt) || 0;
      case "paid_amount":
        return getTotalPaidAmount(order);
      case "balance_amount":
        return getBalanceAmount(order);
      case "approval_status":
        return order.approval_status?.toString().toLowerCase() || "";
      case "duedate":
        return order.duedate ? new Date(order.duedate).getTime() : 0;
      default:
        return "";
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setDateFrom(dayjs().startOf('month').format('YYYY-MM-DD'));
    setDateTo(dayjs().endOf('month').format('YYYY-MM-DD'));
    setCreatedByFilter("");
    setApprovalStatusFilter("");
    setShowRejected(false);
    
    // Clear localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("orderTable_searchQuery");
      localStorage.removeItem("orderTable_statusFilter");
      localStorage.removeItem("orderTable_dateFrom");
      localStorage.removeItem("orderTable_dateTo");
      localStorage.removeItem("orderTable_createdByFilter");
      localStorage.removeItem("orderTable_approvalStatusFilter");
      localStorage.removeItem("orderTable_showRejected");
    }
  };

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      if (filteredOrders.length === 0) {
        alert("No data to export");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Orders");

      // Define columns
      worksheet.columns = [
        { header: "Order ID", key: "order_id", width: 15 },
        { header: "Quotation Number", key: "quote_number", width: 20 },
        { header: "Invoice Number", key: "invoice_number", width: 20 },
        { header: "Client Name", key: "client_name", width: 25 },
        { header: "Company Name", key: "company_name", width: 30 },
        { header: "Contact", key: "contact", width: 15 },
        { header: "State", key: "state", width: 15 },
        { header: "Item Name", key: "item_name", width: 30 },
        { header: "Item Code", key: "item_code", width: 20 },
        { header: "Created By", key: "created_by", width: 15 },
        { header: "Created At", key: "created_at", width: 20 },
        { header: "Due Date", key: "duedate", width: 15 },
        { header: "Payment Status", key: "payment_status", width: 15 },
        { header: "Approval Status", key: "approval_status", width: 15 },
        { header: "Taxable Amount", key: "baseAmount", width: 15 },
        { header: "Tax Amount", key: "taxamt", width: 15 },
        { header: "Amount Details", key: "amount_details", width: 35 },
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data rows
      filteredOrders.forEach((order) => {
        const totalAmt = getTotalAmount(order);
        const paidAmt = getTotalPaidAmount(order);
        const balanceAmt = getBalanceAmount(order);
        const amountDetails = `Total: ₹${totalAmt.toFixed(2)}\nPaid: ₹${paidAmt.toFixed(2)}\nBalance: ₹${balanceAmt.toFixed(2)}`;
        
        worksheet.addRow({
          order_id: order.order_id,
          quote_number: order.quote_number || "",
          invoice_number: order.invoice_number || "",
          client_name: order.client_name || "",
          company_name: order.company_name || "",
          contact: order.contact || "",
          state: order.state || "",
          item_name: order.item_name || "",
          item_code: order.item_code || "",
          created_by: order.created_by || "",
          created_at: order.created_at ? dayjs(order.created_at).format("DD/MM/YYYY HH:mm:ss") : "",
          duedate: order.duedate ? dayjs(order.duedate).format("DD/MM/YYYY") : "",
          payment_status: order.payment_status || "",
          approval_status: order.approval_status || "",
          baseAmount: Number(order.baseAmount || 0),
          taxamt: Number(order.taxamt || 0),
          amount_details: amountDetails,
        });
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Create download link
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders_${dayjs().format("YYYYMMDD")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Filter orders based on search query, status filter, and date range
  useEffect(() => {
    if (!orders) return;

    const lowercasedQuery = searchQuery.toLowerCase();
    let result = orders.filter((order) => {
      // Step 0.5: Filter rejected orders based on toggle
      if (!showRejected && order.approval_status === 'rejected') {
        return false;
      }

      // Step 1: Filter by status
      if (statusFilter) {
        const orderStatus = getStatusText(order)
          .text.toLowerCase()
          .replace(/\s+/g, "");
        if (orderStatus !== statusFilter.toLowerCase()) return false; 
      }

      // Step 2: Date range filter (created_at)
      if (!orderCreatedInDateRange(order, dateFrom, dateTo)) return false;

      // Step 2.5: Filter by created_by
      if (createdByFilter && order.created_by !== createdByFilter) {
        return false;
      }

      if (
        approvalStatusFilter &&
        order.approval_status !== approvalStatusFilter
      ) {
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

    // Step 4: Sort the filtered results
    result = [...result].sort((a, b) => {
      const valA = getSortValue(a, sortColumn);
      const valB = getSortValue(b, sortColumn);

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredOrders(result);
  }, [
    searchQuery,
    orders,
    statusFilter,
    dateFrom,
    dateTo,
    createdByFilter,
    approvalStatusFilter,
    sortColumn,
    sortDirection,
    showRejected,
  ]);

  const dispatchDoneTotals = useMemo(() => {
    if (!orders?.length) return { gstTotal: 0, taxableTotal: 0 };
    return orders.reduce(
      (acc, o) => {
        if (!orderCreatedInDateRange(o, dateFrom, dateTo)) return acc;
        if (o.approval_status !== "approved") return acc;
        acc.gstTotal += Number(o.taxamt) || 0;
        acc.taxableTotal += orderTaxableTotal(o);
        return acc;
      },
      { gstTotal: 0, taxableTotal: 0 }
    );
  }, [orders, dateFrom, dateTo]);

  const filteredTaxableTotals = useMemo(() => {
    if (!filteredOrders?.length) return { taxableTotal: 0 };
    return filteredOrders.reduce(
      (acc, o) => {
        if (o.approval_status !== "approved") return acc;
        acc.taxableTotal += orderTaxableTotal(o);
        return acc;
      },
      { taxableTotal: 0 }
    );
  }, [filteredOrders]);

  const filteredAmountTotals = useMemo(() => {
    if (!filteredOrders?.length) return { totalAmount: 0, paidAmount: 0, taxableAmount: 0, balanceAmount: 0 };
    return filteredOrders.reduce(
      (acc, o) => {
        acc.totalAmount += getTotalAmount(o);
        acc.paidAmount += getTotalPaidAmount(o);
        acc.taxableAmount += getPaymentColumnAmount(o);
        acc.balanceAmount += getBalanceAmount(o);
        return acc;
      },
      { totalAmount: 0, paidAmount: 0, taxableAmount: 0, balanceAmount: 0 }
    );
  }, [filteredOrders]);

  const getStatusText = (order) => {
    if (order.approval_status === "pending") {
      return {
        text: "Pending Approval",
        bg: "bg-orange-100",
        textCol: "text-orange-800",
        icon: <MoreVertical size={14} className="mr-1" />,
      };
    }
    if (order.approval_status === "rejected") {
      return {
        text: "Rejected",
        bg: "bg-red-100",
        textCol: "text-red-800",
        icon: <XCircle size={14} className="mr-1" />,
      };
    }
    // Check for return status first (highest priority)
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
    if (Number(order.is_returned) === 1) {
      // Check if warehouse-in is also done for "Return Completed" status
      if (Number(order.warehouse_in_done) === 1) {
        return {
          text: "Return Completed",
          bg: "bg-green-100",
          textCol: "text-green-800",
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
    if (order.is_cancelled || order.approval_status === "rejected") {
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
    if (compact === "overdue") {
      return {
        text: "Over Due",
        cls: "bg-red-100 text-red-800 border-red-200",
      };
    }
    return {
      text: s ? paymentStatusRaw : "Pending",
      cls: "bg-white text-gray-700 border-gray-300",
    };
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Combined Amount Summary Card */}
        <div className={`w-full rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm p-3 sm:p-4 cursor-default hover:shadow-md transition-shadow`}>
          <div className="flex items-start justify-between">
            <div className="w-full">
              <p className="text-xs text-emerald-700 mb-0.5 font-semibold uppercase tracking-wide">
                Amount Summary
              </p>
              <p className="text-[10px] text-emerald-600/90 mb-2 leading-tight">
                All orders overview
              </p>
              
              {/* Total Amount */}
              <div className="mb-2 pb-2 border-b border-emerald-100">
                <p className="text-[10px] text-emerald-600 font-medium">Total Amount</p>
                <p className="text-lg font-bold text-emerald-950 tabular-nums">
                  ₹{filteredAmountTotals.totalAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {/* Paid Amount */}
              <div>
                <p className="text-[10px] text-blue-600 font-medium">Paid Amount</p>
                <p className="text-lg font-bold text-blue-700 tabular-nums">
                  ₹{filteredAmountTotals.paidAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Combined Balance & Taxable Amount Card */}
        <div className={`w-full rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm p-3 sm:p-4 cursor-default hover:shadow-md transition-shadow`}>
          <div className="flex items-start justify-between">
            <div className="w-full">
              <p className="text-xs text-purple-700 mb-0.5 font-semibold uppercase tracking-wide">
                Balance & Taxable
              </p>
              <p className="text-[10px] text-purple-600/90 mb-2 leading-tight">
                Summary details
              </p>

              {/* Balance Amount */}
              <div className="mb-2 pb-2 border-b border-purple-100">
                <p className="text-[10px] text-orange-600 font-medium">Balance Amount</p>
                <p className="text-lg font-bold text-orange-700 tabular-nums">
                  ₹{filteredAmountTotals.balanceAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              {/* Taxable Amount */}
              <div>
                <p className="text-[10px] text-purple-600 font-medium">Taxable Amount</p>
                <p className="text-lg font-bold text-purple-950 tabular-nums">
                  ₹{filteredAmountTotals.taxableAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Original Taxable Card - COMMENTED OUT */}
        {/* <div
          onClick={() => {
            if (userRole !== "SUPERADMIN") return;
            const next = taxableClickCount + 1;
            setTaxableClickCount(next);
            if (next >= 5) {
              setShowNukePanel((p) => !p);
              setTaxableClickCount(0);
            }
          }}
          className={`w-full rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-sm p-3 sm:p-4 cursor-default hover:shadow-md transition-shadow`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-violet-700 mb-0.5 font-semibold uppercase tracking-wide">
                Dispatch Taxable
              </p>
              <p className="text-[10px] text-violet-600/90 mb-1 leading-tight">
                Total amount without GST
              </p>
              <p className="text-xl sm:text-2xl font-bold text-violet-950 tabular-nums">
                ₹
                {dispatchDoneTotals.taxableTotal.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Original Filtered Taxable Card - COMMENTED OUT */}
        {/* <div
          className={`w-full rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm p-3 sm:p-4 cursor-default hover:shadow-md transition-shadow`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-indigo-700 mb-0.5 font-semibold uppercase tracking-wide">
                Filtered Taxable
              </p>
              <p className="text-[10px] text-indigo-600/90 mb-1 leading-tight">
                {createdByFilter ? `By ${createdByFilter}` : "All Users"}
              </p>
              <p className="text-xl sm:text-2xl font-bold text-indigo-950 tabular-nums">
                ₹
                {filteredTaxableTotals.taxableTotal.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div> */}
      </div>

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
        <div className="flex gap-2">
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors w-full sm:w-auto"
          >
            Reset Filters
          </button>
          <button
            onClick={handleExportToExcel}
            disabled={isExporting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto"
          >
            {isExporting ? "Exporting..." : "Export Excel"}
          </button>
        </div>
      </div>

      {/* 🧰 Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
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
          <label className="block text-xs text-gray-600 mb-1">
            Approval Status
          </label>
          <select
            value={approvalStatusFilter}
            onChange={(e) => setApprovalStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Show Rejected Orders Toggle */}
      <div className="mt-3 flex items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showRejected}
            onChange={(e) => setShowRejected(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Show Rejected Orders</span>
        </label>
      </div>

      {/* 👨‍💼 TABLE VIEW for large screens */}
      <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] bg-white rounded-xl shadow-lg">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-gray-800 text-white sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 font-semibold text-center">#</th>
              <th 
                className="px-3 py-3 font-semibold text-left cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("order_id")}
              >
                <div className="flex items-center gap-1">
                  Order ID
                  {sortColumn === "order_id" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-left cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("created_by")}
              >
                <div className="flex items-center gap-1">
                  Created By
                  {sortColumn === "created_by" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-left cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("created_at")}
              >
                <div className="flex items-center gap-1">
                  Order Date
                  {sortColumn === "created_at" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-left cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("company_name")}
              >
                <div className="flex items-center gap-1">
                  Company
                  {sortColumn === "company_name" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-left cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("item_name")}
              >
                <div className="flex items-center gap-1">
                  Item
                  {sortColumn === "item_name" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-center cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1 justify-center">
                  Status
                  {sortColumn === "status" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-center cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("payment_status")}
              >
                <div className="flex items-center gap-1 justify-center">
                  Taxable
                  {sortColumn === "payment_status" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-center cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("totalamt")}
              >
                <div className="flex items-center gap-1 justify-center">
                  Amount Details
                  {(sortColumn === "totalamt" || sortColumn === "paid_amount" || sortColumn === "balance_amount") && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-center cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("approval_status")}
              >
                <div className="flex items-center gap-1 justify-center">
                  Approval
                  {sortColumn === "approval_status" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th 
                className="px-3 py-3 font-semibold text-center cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleSort("duedate")}
              >
                <div className="flex items-center gap-1 justify-center">
                  Due Date
                  {sortColumn === "duedate" && (
                    sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  )}
                </div>
              </th>
              <th className="px-3 py-3 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((r, i) => {
                const status = getStatusText(r);
                const pay = getPaymentBadge(r.payment_status);
                return (
                  <tr
                    key={r.order_id}
                    className="hover:bg-gray-50 text-center transition-colors duration-150"
                  >
                    <td className="px-3 py-3">{i + 1}</td>
                    <td className="px-3 py-3 font-medium text-gray-800">
                      <div className="space-y-1">
                        {r.quote_number ? (
                          <Link
                            href={`/admin-dashboard/quotations/${r.quote_number}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-sm break-words"
                            title="View Quotation"
                          >
                            Q: {r.quote_number}
                          </Link>
                        ) : (
                          <div className="text-gray-400 text-xs">No Quote</div>
                        )}
                        <div className="text-gray-800 font-medium">
                          Ord: {r.order_id}
                        </div>
                      </div>
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
                          <span className="font-semibold">Item:</span>{" "}
                          {r.item_name}
                        </div>
                        <div>
                          <span className="font-semibold">Modal:</span>{" "}
                          {r.item_code}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.textCol}`}
                      >
                        {status.icon} {status.text}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="font-semibold text-sm">
                          ₹{getPaymentColumnAmount(r).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${pay.cls}`}
                        >
                          {pay.text}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="font-semibold text-gray-700">Total:</span>
                          <span className="font-bold text-gray-900">
                            ₹{getTotalAmount(r).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="font-semibold text-green-700">Paid:</span>
                          <span className="font-bold text-green-600">
                            ₹{getTotalPaidAmount(r).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="font-semibold text-orange-700">Balance:</span>
                          <span className="font-bold text-orange-600">
                            ₹{getBalanceAmount(r).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <ApprovalActions r={r} userRole={userRole} />
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
                    <td className="px-3 py-3 text-center">
                      {dayjs(r.duedate).format("DD/MM/YYYY")}
                    </td>
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
                <td colSpan={13} className="px-6 py-4 text-center text-gray-500">
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
            const pay = getPaymentBadge(r.payment_status);
            return (
              <div
                key={r.order_id}
                className="bg-white border border-gray-200 rounded-xl shadow-md p-4 space-y-2 text-sm"
              >
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">#{i + 1}</span>
                  <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
                    <span className="font-medium text-gray-800 text-xs shrink-0">
                      {dayjs(r.created_at).format("DD/MM/YYYY")}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${status.bg} ${status.textCol}`}
                    >
                      {status.text}
                    </span>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      {r.approval_status === "approved" && (
                        <div className="font-semibold text-xs">
                          ₹{amountWithoutGst(r).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${pay.cls}`}
                      >
                        {pay.text}
                      </span>
                    </div>
                    <span className="shrink-0">
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
                  {r.quote_number ? (
                    <Link
                      href={`/admin-dashboard/quotations/${r.quote_number}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                      title="View Quotation"
                    >
                      <strong>Quote #:</strong> {r.quote_number}
                    </Link>
                  ) : (
                    <div className="text-gray-400 text-xs">
                      <strong>Quote:</strong> Not available
                    </div>
                  )}
                </div>
                <div>
                  <strong>Created By:</strong> {r.created_by || "-"}
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
                <div>
                  <strong>Due Date:</strong> {dayjs(r.duedate).format("DD/MM/YYYY")}
                </div>
                <div>
                  <strong>Total Amount:</strong> ₹{getTotalAmount(r).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div>
                  <strong>Paid Amount:</strong> <span className="text-green-600">₹{getTotalPaidAmount(r).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</span>
                </div>
                <div>
                  <strong>Balance Amount:</strong> <span className="text-orange-600">₹{getBalanceAmount(r).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</span>
                </div>

                {/* Approval Actions - Approve/Reject/Revert - visible on mobile */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex flex-col gap-2">
                    <ApprovalActions r={r} userRole={userRole} />
                    {r.approval_remark && (
                      <span
                        className="text-xs text-gray-600 block"
                        title={r.approval_remark}
                      >
                        Remark: {r.approval_remark}
                      </span>
                    )}
                  </div>
                </div>

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

// ── Return Initiate ──────────────────────────────────────────────────────────
function ReturnInitiateMenuItem({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const dispatchDone = Number(order.dispatch_status) === 1;
  if (!dispatchDone) return null;

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const res = await fetch(
        `/api/orders/items?quote_number=${encodeURIComponent(order.quote_number)}`
      );
      const json = await res.json();
      if (json.success) {
        setItems(json.items || []);
      } else {
        toast.error(json.error || "Failed to load items");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load order items");
    } finally {
      setLoadingItems(false);
    }
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    setOpen(true);
    setSelectedItems({});
    fetchItems();
  };

  const toggleItem = (itemId) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = true;
      }
      return next;
    });
  };

  const selectedCount = Object.keys(selectedItems).length;

  const handleCreateCreditNote = async () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one product to return");
      return;
    }
    const returnItems = items.filter((it) => selectedItems[it.id]);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/return-initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          quote_number: order.quote_number,
          items: returnItems.map((it) => ({
            id: it.id,
            item_name: it.item_name,
            item_code: it.item_code,
            qty: it.quantity || 1,
            price: it.total_taxable_amt || it.taxable_price || it.total_price || 0,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Credit note created! Opening…");
        setOpen(false);
        // Store draft data in sessionStorage — will only be saved to DB on "Download & Save"
        sessionStorage.setItem("creditNoteDraft", JSON.stringify(json.draft));
        sessionStorage.setItem("creditNoteReturnPath", "/admin-dashboard/order");
        // Navigate to the credit note preview page
        router.push(`/admin-dashboard/credit-notes/new`);
      } else {
        toast.error(json.error || "Failed to create credit note");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to initiate return");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 text-orange-700 text-left"
        title="Initiate Return"
      >
        <ArrowUp size={16} />
        <span>Return Initiate</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Return Initiate
                </h3>
                <p className="text-sm text-gray-500">
                  Order: <span className="font-medium text-gray-700">{order.order_id}</span>
                  {order.client_name && (
                    <> &nbsp;·&nbsp; {order.client_name}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Instructions */}
            <p className="text-sm text-gray-600 mb-4">
              Select the products to include in the return. A credit note will be created for the selected items.
            </p>

            {/* Product List */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
              {loadingItems ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  Loading products…
                </div>
              ) : items.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No products found for this order.
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-10 px-3 py-2"></th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Code</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`border-t border-gray-100 cursor-pointer transition-colors ${
                          selectedItems[item.id]
                            ? "bg-orange-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!selectedItems[item.id]}
                            onChange={() => toggleItem(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 accent-orange-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {item.item_name || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                          {item.item_code || "-"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {item.quantity || 1}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          ₹{Number(
                            item.total_taxable_amt || item.taxable_price || item.total_price || 0
                          ).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Selection summary */}
            {selectedCount > 0 && (
              <p className="text-sm text-orange-700 font-medium mb-4">
                {selectedCount} product{selectedCount > 1 ? "s" : ""} selected for return
              </p>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCreditNote}
                disabled={submitting || selectedCount === 0 || loadingItems}
                className="px-5 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {submitting ? "Creating…" : "Create Credit Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function ActionButtons({ r, userRole, isOpen, toggleMenu }) {
  if (r.is_cancelled) {
    return null;
  }

  const popRef = useRef(null);
  const role = (userRole || "").toString().trim().toLowerCase();
  const canViewSales = [
    "back office",
    "accountant",
    "superadmin",
    "sales",
    "sales head",
    "team leader",
    "gem portal",
    "warehouse incharge",
  ].includes(role);
  const isSuperAdmin = role === "superadmin";
  const isAccountant = role.includes("accountant");
  const canManageReturns = isSuperAdmin || isAccountant;
  const isWarehouse = role === "warehouse incharge";
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
          className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black/5 z-20 border"
        >
          <div className="py-1 text-sm">
            {canViewSales && (
              <Link
                href={`/admin-dashboard/order/${r.order_id}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                title="View Sales"
                onClick={(e) => e.stopPropagation()}
              >
                <ClipboardList size={16} />
                <span>View Sales</span>
              </Link>
            )}
            {["superadmin"].includes(role) &&
              (r.report_file ? (
                <Link
                  href={`/admin-dashboard/order/view/${r.order_id}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                  title="View Report"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText size={16} />
                  <span>View Report</span>
                </Link>
              ) : (
                <>
                  <Link
                    href={`/admin-dashboard/order/upload/${r.order_id}`}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-yellow-700"
                    title="Upload Report"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <UploadCloud size={16} />
                    <span>Upload Report</span>
                  </Link>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DeleteButton orderId={r.order_id} />
                  </div>
                </>
              ))}
            {canManageReturns &&
              (hasBooking ? (
                <Link
                  href={`/admin-dashboard/order/view-booking/${r.order_id}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                  title="View Booking"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileCheck size={16} />
                  <span>View Booking</span>
                </Link>
              ) : (
                <Link
                  href={`/admin-dashboard/order/upload-booking/${r.order_id}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-green-700"
                  title="Create Booking"
                  onClick={(e) => e.stopPropagation()}
                >
                  <UploadCloud size={16} />
                  <span>Create Booking</span>
                </Link>
              ))}
            {(isWarehouse || canManageReturns) &&
              hasBooking &&
              dispatchStatus === 0 && (
                <>
                  <Link
                    href={`/admin-dashboard/order/dispatch/${r.order_id}`}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                    title="Dispatch"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CheckCircle size={16} />
                    <span>Dispatch</span>
                  </Link>
                </>
              )}
            {(isWarehouse || canManageReturns) &&
              hasBooking &&
              dispatchStatus === 1 && (
                <>
                  <Link
                    href={`/admin-dashboard/order/dispatch/view/${r.order_id}`}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                    title="View Dispatch"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Search size={16} />
                    <span>View Dispatch</span>
                  </Link>
                </>
              )}
            {["accountant", "superadmin"].includes(role) && r.report_file && (
              <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <EditPaymentButton order={r} />
              </div>
            )}
            <UpdateDeliveryMenuItem order={r} />
            {canManageReturns &&
              dispatchStatus === 1 &&
              ![1, 2, 3].includes(Number(r.is_returned || 0)) && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <ReturnInitiateMenuItem order={r} />
              </div>
            )}
            {[3, 1, 2].includes(Number(r.is_returned)) && r.credit_note_id && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <Link
                  href={`/admin-dashboard/credit-notes/${r.credit_note_id}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-teal-700"
                  title="View Credit Note"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText size={16} />
                  <span>View Credit Note</span>
                </Link>
              </div>
            )}
            {canManageReturns &&
              (Number(r.is_returned) === 3 || Number(r.return_booking_done) === 1) && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <ReturnBookingMenuItem order={r} />
              </div>
            )}
            {canManageReturns &&
              Number(r.is_returned) === 3 &&
              Number(r.return_booking_done) === 1 &&
              Number(r.warehouse_in_done) !== 1 && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <WarehouseInMenuItem order={r} />
              </div>
            )}
            {canManageReturns && Number(r.warehouse_in_done) === 1 && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <WarehouseInMenuItem order={r} />
              </div>
            )}
            {isSuperAdmin && (
              <div className="border-t border-gray-100 mt-1 pt-1">
                <DeletePermanentlyButton orderId={r.order_id} onDeleted={toggleMenu} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DeletePermanentlyButton({ orderId, onDeleted }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch("/api/delete-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        onDeleted?.();
        router.refresh();
      } else {
        alert(json.error || "Delete failed");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete order");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* <button
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 text-left"
        title="Delete permanently from database"
      >
        <Trash2 size={16} />
        <span>Delete Permanently</span>
      </button> */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-red-600 mb-2">Delete Permanently</h3>
            <p className="text-sm text-gray-600 mb-4">
              Order <strong>{orderId}</strong> will be permanently deleted from the database. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
    if (Number(order.dispatch_status) !== 1) return false;
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

function canRevertOrder(dispatchStatus) {
  // Cannot revert if order is dispatched
  return !dispatchStatus;
}

function WarehouseInMenuItem({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isDone = Number(order.warehouse_in_done) === 1;

  const fmtDate = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-IN");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) { setError("Please upload warehouse-in image."); return; }
    setError(""); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("order_id", order.order_id);
      fd.append("warehouse_in_date", date);
      fd.append("image", image);
      const res = await fetch("/api/orders/warehouse-in", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) {
        setSuccess("✅ Warehouse-In done! Stock updated.");
        setTimeout(() => { setOpen(false); setSuccess(""); router.refresh(); }, 1500);
      } else {
        setError(json.error || "Failed to process warehouse-in.");
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
        className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-sm ${isDone ? "text-blue-700" : "text-green-700"}`}
      >
        {isDone ? <FileCheck size={16} /> : <PackageCheck size={16} />}
        <span>{isDone ? "View Warehouse-In" : "Warehouse In"}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 text-center">
                {isDone ? "View Warehouse-In" : "Warehouse In"}
              </h2>
              <table className="w-full mb-4 text-sm border">
                <tbody>
                  {[
                    ["Order ID", order.order_id],
                    ["Client", order.client_name],
                    ["Booking Ref", order.return_booking_ref || "-"],
                  ].map(([label, value]) => (
                    <tr key={label} className="border">
                      <td className="p-2 font-medium bg-gray-50 w-2/5">{label}</td>
                      <td className="p-2">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isDone ? (
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
                  {order.warehouse_in_image ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Proof Image</p>
                      <a
                        href={order.warehouse_in_image}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="block rounded-lg overflow-hidden border border-gray-200"
                      >
                        <img
                          src={order.warehouse_in_image}
                          alt="Warehouse-In proof"
                          className="w-full h-52 object-cover"
                        />
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No image uploaded</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse In Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full border px-3 py-2 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image <span className="text-red-500">*</span></label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImage(e.target.files[0] || null)}
                      required
                      className="w-full border px-3 py-2 rounded-md text-sm"
                    />
                  </div>
                  {error && <p className="text-red-600 font-medium">{error}</p>}
                  {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md font-bold">{success}</div>}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={submitting} className={`flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}>
                      {submitting ? "Processing..." : "Confirm Warehouse In"}
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

  // If booking already done → show "View Return Booking" details instead
  if (hasReturnBooking) {
    return (
      <>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-indigo-700 text-sm"
        >
          <FileText size={16} />
          <span>View Return Booking</span>
        </button>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4 text-center">Return Booking Details</h2>
                <table className="w-full text-sm border">
                  <tbody>
                    {[
                      ["Order ID", order.order_id],
                      ["Booking Ref ID", order.return_booking_ref || "-"],
                      ["Booking Date", order.return_booking_date ? new Date(order.return_booking_date).toLocaleDateString("en-IN") : "-"],
                      ["Expected Pickup Date", order.expected_pickup_date ? new Date(order.expected_pickup_date).toLocaleDateString("en-IN") : "-"],
                      ["Booking URL", order.return_booking_url || "-"],
                      ["Remarks", order.return_booking_remarks || "-"],
                      ["Booked By", order.return_booking_by || "-"],
                    ].map(([label, value]) => (
                      <tr key={label} className="border">
                        <td className="p-2 font-medium w-2/5 bg-gray-50">{label}</td>
                        <td className="p-2 break-all">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

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
                  <label className="block text-sm font-medium text-gray-700">Return Booking Date</label>
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
                  <label className="block text-sm font-medium text-gray-700">Expected Pickup Date</label>
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

function ApprovalActions({ r, userRole }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'approve' | 'reject'
  const [remark, setRemark] = useState("");
  const isSuperAdmin =
    (userRole || "").toString().trim().toUpperCase() === "SUPERADMIN";
  const revertAllowed = canRevertOrder(r.dispatch_status);

  const submitAction = async (action, remarkVal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: r.order_id,
          action,
          remark: remarkVal || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setModalAction(null);
        setRemark("");
        router.refresh();
      } else {
        alert(json.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to process approval");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    if (action === "pending") {
      if (r.dispatch_status) {
        toast.error("Cannot revert: Order is already dispatched.");
        return;
      }
      if (!confirm("Reset this order to Pending approval?")) return;
      await submitAction("pending");
      return;
    }
    // For approve/reject, open modal with remark
    setModalAction(action);
  };

  const handleModalSubmit = () => {
    submitAction(modalAction, remark);
  };

  if (r.approval_status === "approved") {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-green-600 font-semibold px-2 py-1 bg-green-50 rounded-lg border border-green-100">
          <CheckCircle size={14} />
          <span>Approved</span>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => handleAction("pending")}
            disabled={loading || !revertAllowed}
            className={`text-xs ${revertAllowed ? "text-gray-500 hover:text-orange-600 underline" : "text-gray-400 cursor-not-allowed"}`}
            title={
              r.dispatch_status 
                ? "Cannot revert: Order is already dispatched" 
                : "Reset to Pending"
            }
          >
            Revert
          </button>
        )}
      </div>
    );
  }
  if (r.approval_status === "rejected") {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 text-red-600 font-semibold px-2 py-1 bg-red-50 rounded-lg border border-red-100">
          <XCircle size={14} />
          <span>Rejected</span>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => handleAction("pending")}
            disabled={loading || !revertAllowed}
            className={`text-xs ${revertAllowed ? "text-gray-500 hover:text-orange-600 underline" : "text-gray-400 cursor-not-allowed"}`}
            title={
              r.dispatch_status 
                ? "Cannot revert: Order is already dispatched" 
                : "Reset to Pending"
            }
          >
            Revert
          </button>
        )}
      </div>
    );
  }

  if (isSuperAdmin) {
    return (
      <>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => handleAction("approve")}
            disabled={loading}
            className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-medium border border-green-200"
          >
            Approve
          </button>
          <button
            onClick={() => handleAction("reject")}
            disabled={loading}
            className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-medium border border-red-200"
          >
            Reject
          </button>
        </div>
        {modalAction && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={(e) => e.target === e.currentTarget && setModalAction(null)}
          >
            <div
              className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold mb-3 text-gray-800">
                {modalAction === "approve" ? "Approve Order" : "Reject Order"}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Order: <strong>{r.order_id}</strong>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remark (optional)
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Add remark..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setModalAction(null);
                    setRemark("");
                  }}
                  className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSubmit}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50 ${
                    modalAction === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {loading ? "Processing..." : modalAction === "approve" ? "Approve" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <span className="text-orange-600 font-medium italic text-xs">
      Waiting for Admin
    </span>
  );
}
