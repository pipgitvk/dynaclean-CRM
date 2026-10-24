"use client";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Download,
  ArrowUp,
  Pencil,
  CreditCard,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import {
  buildOrderPaymentRows,
  sumOrderPaymentAmounts,
} from "@/lib/orderPaymentHistory";
import {
  deriveOrderListPaymentStatus,
  getOrderListRemainingPayment,
} from "@/lib/paymentOrderStatus";
import { isBookingAllowedForOrder } from "@/lib/orderBookingEligibility";
import {
  canCreateFollowUpBooking,
  canOpenDispatchForOrder,
  canViewDispatchPanelForOrder,
  canShowOrderDeliveryActions,
  isRemainDispatchRound,
  orderHasDispatchedStock,
} from "@/lib/orderDeliveryEligibility";
import {
  isOrderFullyDelivered,
  isOrderPartialDelivery,
  orderHasDeliveryRecord,
} from "@/lib/orderDeliveryStatus";
import {
  getDeliveryBatchForView,
  orderHasSecondDeliveryBatch,
} from "@/lib/orderDeliveryBatches";
import AccountantReportActionLinks from "@/components/orders/AccountantReportActionLinks";
import OrderInvoiceMenuLinks from "@/components/orders/OrderInvoiceMenuLinks";
import DispatchProductSelectModal from "@/components/orders/DispatchProductSelectModal";
import OrderBookingViewMenuLinks from "@/components/orders/OrderBookingViewMenuLinks";
import OrderDeliveryMenuLinks from "@/components/orders/OrderDeliveryMenuLinks";
import {
  OrderListSearchInput,
  OrderListSearchApplyButton,
  OrderListSearchResetButton,
} from "@/components/orders/OrderListSearchFilterControls";
import {
  canManageAnyOrderDeliveryRole,
  canViewOrderDeliveryDetailsRole,
  isAccountantOnlyMenuRole,
  isSuperAdminRole,
} from "@/lib/roleKeyUtils";

import DeleteButton from "@/components/accounts/DeleteButton";
import ReturnInitiateMenuItem from "@/components/orders/ReturnInitiateMenuItem";
import {
  ViewReturnBookingMenuItem,
  ReturnBookingMenuItem,
  WarehouseInMenuItem,
} from "@/components/orders/ReturnBookingWarehouseMenuItems";
import ViewCreditNoteMenuLink from "@/components/orders/ViewCreditNoteMenuLink";
import AccountantReturnViewMenuItems from "@/components/orders/AccountantReturnViewMenuItems";
import LinkedStatementPaymentCell from "@/components/orders/LinkedStatementPaymentCell";

const PAGE_SIZE = 40;
const SCROLL_LOAD_OFFSET_PX = 200;

export default function OrderTable({ userRole }) {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [scrollLoadEnabled, setScrollLoadEnabled] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const pageRef = useRef(1);
  const fetchAbortRef = useRef(null);
  const tableScrollRef = useRef(null);
  const searchParams = useSearchParams();
  // Initialize from localStorage with defaults
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_searchQuery") || "";
    }
    return "";
  });
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_searchQuery") || "";
    }
    return "";
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_statusFilter") || "";
    }
    return "";
  });
  const [appliedStatusFilter, setAppliedStatusFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_statusFilter") || "";
    }
    return "";
  });
  const [paymentTermsFilter, setPaymentTermsFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_paymentTermsFilter") || "";
    }
    return "";
  });
  const [appliedPaymentTermsFilter, setAppliedPaymentTermsFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_paymentTermsFilter") || "";
    }
    return "";
  });
  const [dateFrom, setDateFrom] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_dateFrom") ?? "";
    }
    return "";
  });
  const [appliedDateFrom, setAppliedDateFrom] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_dateFrom") ?? "";
    }
    return "";
  });
  const [dateTo, setDateTo] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_dateTo") ?? "";
    }
    return "";
  });
  const [appliedDateTo, setAppliedDateTo] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_dateTo") ?? "";
    }
    return "";
  });
  const [createdByFilter, setCreatedByFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_createdByFilter") || "";
    }
    return "";
  });
  const [appliedCreatedByFilter, setAppliedCreatedByFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("accountsOrderTable_createdByFilter") || "";
    }
    return "";
  });
  const [openMenuId, setOpenMenuId] = useState(null); // State to track which menu is open

  const fetchOrdersPage = useCallback(
    async ({ page = 1, append = false, filters } = {}) => {
      const f = filters || {
        search: appliedSearchQuery,
        dateFrom: appliedDateFrom,
        dateTo: appliedDateTo,
        createdBy: appliedCreatedByFilter,
        paymentTerms: appliedPaymentTermsFilter,
      };
      if (append) {
        setLoadingMore(true);
      } else {
        setListLoading(true);
        setFetchError(null);
      }

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (f.search) params.set("search", f.search);
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.createdBy) params.set("createdBy", f.createdBy);
      if (f.paymentTerms) params.set("paymentTerms", f.paymentTerms);

      try {
        if (!append && fetchAbortRef.current) {
          fetchAbortRef.current.abort();
        }
        const controller = new AbortController();
        if (!append) fetchAbortRef.current = controller;

        const res = await fetch(`/api/accounts/orders/list?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.detail || json.error || "Failed to load orders");
        }

        const rows = json.data || [];
        setOrders((prev) => {
          if (!append) return rows;
          const seen = new Set(prev.map((o) => o.order_id));
          const merged = [...prev];
          for (const row of rows) {
            if (!seen.has(row.order_id)) {
              seen.add(row.order_id);
              merged.push(row);
            }
          }
          return merged;
        });
        pageRef.current = page;
        setHasMore(Boolean(json.meta?.hasMore));
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Order list fetch failed:", err);
        if (!append) {
          setOrders([]);
          setFetchError(err?.message || "Failed to load orders");
        }
      } finally {
        if (fetchAbortRef.current?.signal.aborted && !append) return;
        if (append) {
          setLoadingMore(false);
        } else {
          setListLoading(false);
          setScrollLoadEnabled(true);
        }
      }
    },
    [
      appliedSearchQuery,
      appliedDateFrom,
      appliedDateTo,
      appliedCreatedByFilter,
      appliedPaymentTermsFilter,
    ],
  );

  const resetAndFetchOrders = useCallback(() => {
    pageRef.current = 1;
    setHasMore(true);
    setScrollLoadEnabled(false);
    fetchOrdersPage({ page: 1, append: false });
  }, [fetchOrdersPage]);

  const loadMoreOrders = useCallback(() => {
    if (listLoading || loadingMore || !hasMore) return;
    fetchOrdersPage({ page: pageRef.current + 1, append: true });
  }, [listLoading, loadingMore, hasMore, fetchOrdersPage]);

  const handleApplySearch = useCallback(() => {
    setAppliedSearchQuery(searchQuery);
    setAppliedStatusFilter(statusFilter);
    setAppliedPaymentTermsFilter(paymentTermsFilter);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setAppliedCreatedByFilter(createdByFilter);
    if (typeof window !== "undefined") {
      localStorage.setItem("accountsOrderTable_searchQuery", searchQuery);
      localStorage.setItem("accountsOrderTable_statusFilter", statusFilter);
      localStorage.setItem("accountsOrderTable_paymentTermsFilter", paymentTermsFilter);
      localStorage.setItem("accountsOrderTable_dateFrom", dateFrom);
      localStorage.setItem("accountsOrderTable_dateTo", dateTo);
      localStorage.setItem("accountsOrderTable_createdByFilter", createdByFilter);
    }
    pageRef.current = 1;
    setHasMore(true);
    setScrollLoadEnabled(false);
    fetchOrdersPage({
      page: 1,
      append: false,
      filters: {
        search: searchQuery,
        dateFrom,
        dateTo,
        createdBy: createdByFilter,
        paymentTerms: paymentTermsFilter,
      },
    });
  }, [
    searchQuery,
    statusFilter,
    paymentTermsFilter,
    dateFrom,
    dateTo,
    createdByFilter,
    fetchOrdersPage,
  ]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setAppliedSearchQuery("");
    setStatusFilter("");
    setAppliedStatusFilter("");
    setPaymentTermsFilter("");
    setAppliedPaymentTermsFilter("");
    setDateFrom("");
    setAppliedDateFrom("");
    setDateTo("");
    setAppliedDateTo("");
    setCreatedByFilter("");
    setAppliedCreatedByFilter("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("accountsOrderTable_searchQuery");
      localStorage.removeItem("accountsOrderTable_statusFilter");
      localStorage.removeItem("accountsOrderTable_paymentTermsFilter");
      localStorage.removeItem("accountsOrderTable_dateFrom");
      localStorage.removeItem("accountsOrderTable_dateTo");
      localStorage.removeItem("accountsOrderTable_createdByFilter");
    }
    router.replace("/accounts-dashboard/order", { scroll: false });
    pageRef.current = 1;
    setHasMore(true);
    setScrollLoadEnabled(false);
    fetchOrdersPage({
      page: 1,
      append: false,
      filters: {
        search: "",
        dateFrom: "",
        dateTo: "",
        createdBy: "",
        paymentTerms: "",
      },
    });
  }, [router, fetchOrdersPage]);

  useEffect(() => {
    fetchOrdersPage({ page: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scrollLoadEnabled) return;

    const onScroll = (el) => {
      if (listLoading || loadingMore || !hasMore) return;
      const nearBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_LOAD_OFFSET_PX;
      if (nearBottom) loadMoreOrders();
    };

    const tableEl = tableScrollRef.current;
    const mainEl = document.querySelector("main.overflow-auto");

    const onTableScroll = () => tableEl && onScroll(tableEl);
    const onMainScroll = () => mainEl && onScroll(mainEl);

    tableEl?.addEventListener("scroll", onTableScroll, { passive: true });
    mainEl?.addEventListener("scroll", onMainScroll, { passive: true });

    return () => {
      tableEl?.removeEventListener("scroll", onTableScroll);
      mainEl?.removeEventListener("scroll", onMainScroll);
    };
  }, [scrollLoadEnabled, loadMoreOrders, hasMore, listLoading, loadingMore]);

  useEffect(() => {
    const statusFromCard = searchParams.get("status");
    const fromCard = searchParams.get("fromCard");

    if (statusFromCard) {
      setStatusFilter(statusFromCard);
      setAppliedStatusFilter(statusFromCard);
    }

    if (fromCard === "1") {
      setSearchQuery("");
      setDateFrom("");
      setDateTo("");
      setCreatedByFilter("");
      setPaymentTermsFilter("");
      setAppliedSearchQuery("");
      setAppliedDateFrom("");
      setAppliedDateTo("");
      setAppliedCreatedByFilter("");
      setAppliedPaymentTermsFilter("");
      resetAndFetchOrders();
    }
  }, [searchParams, resetAndFetchOrders]);

  const toggleMenu = (id) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const getStatusText = (order) => {
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
      if (Number(order.warehouse_in_done) === 1) {
        return {
          text: "Return Completed",
          bg: "bg-orange-100",
          textCol: "text-orange-800",
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

  const matchesListFilters = useCallback(
    (order, { omitCreatedBy = false } = {}) => {
      if (statusFilter) {
        const orderStatus = getStatusText(order)
          .text.toLowerCase()
          .replace(/\s+/g, "");
        if (orderStatus !== statusFilter.toLowerCase()) return false;
      }

      if (order.approval_status === "pending") {
        return false;
      }

      if (!omitCreatedBy && appliedCreatedByFilter && order.created_by !== appliedCreatedByFilter) {
        return false;
      }

      if (appliedPaymentTermsFilter && order.payment_terms !== appliedPaymentTermsFilter) {
        return false;
      }

      return true;
    },
    [statusFilter, appliedCreatedByFilter, appliedPaymentTermsFilter],
  );

  const createdByFilterOptions = useMemo(() => {
    if (!orders?.length) return [];
    const users = new Set();
    orders.forEach((order) => {
      if (matchesListFilters(order, { omitCreatedBy: true }) && order.created_by) {
        users.add(String(order.created_by).trim());
      }
    });
    return [...users].sort((a, b) => a.localeCompare(b));
  }, [orders, matchesListFilters]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => matchesListFilters(order));
  }, [orders, matchesListFilters]);

  const exportToCSV = () => {
    const headers = [
      "Order ID", "Quotation", "Created By", "Order Date", "Client Name", "Company Name",
      "Contact", "Location", "Item Name", "Item Code", "Status", "Payment Status",
      "Invoice Number", "Amount Received (Linked)", "Due Date", "Total Amount", "Paid Amount",
    ];
    const csvData = filteredOrders.map((order) => {
      const prevAmounts = (order.payment_amount || "")
        .toString()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((x) => Number(x))
        .filter((n) => !isNaN(n));
      const totalPaid = prevAmounts.reduce((sum, n) => sum + n, 0);

      return [
        order.order_id,
        order.quote_number,
        order.created_by,
        dayjs(order.created_at).format("DD-MM-YYYY"),
        order.client_name,
        order.company_name,
        order.contact,
        order.state,
        order.item_name,
        order.item_code,
        getStatusText(order).text,
        order.payment_status,
        order.invoice_number || "",
        order.amount_received ?? "",
        dayjs(order.duedate).format("DD-MM-YYYY"),
        order.totalamt || 0,
        totalPaid,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell || ""}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orders-${dayjs().format("YYYY-MM-DD")}.csv`;
    link.click();
  };

  const showListLoadingEmpty = listLoading && filteredOrders.length === 0;
  const showNoOrdersEmpty = !listLoading && filteredOrders.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* 🧰 Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <OrderListSearchInput
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onApply={handleApplySearch}
        />
        <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
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
        <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
          <label className="block text-xs text-gray-600 mb-1">From Date</label>
          <TypeableDateFilterInput value={dateFrom} onChange={setDateFrom} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
          <label className="block text-xs text-gray-600 mb-1">To Date</label>
          <TypeableDateFilterInput value={dateTo} onChange={setDateTo} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
          <label className="block text-xs text-gray-600 mb-1">Created By</label>
          <select
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Users</option>
            {createdByFilterOptions.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
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
        <div className="flex items-end gap-2 shrink-0 order-last">
          <OrderListSearchResetButton onReset={handleResetFilters} />
          <OrderListSearchApplyButton onApply={handleApplySearch} embedded />
        </div>
      </div>
      <p className="text-xs text-gray-500">Set filters, then click Search to update the list.</p>

      {/* 👨‍💼 TABLE VIEW for large screens */}
      {fetchError && (
        <p className="text-sm text-red-600">{fetchError}</p>
      )}

      <div
        ref={tableScrollRef}
        className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[calc(100vh-160px)] min-h-[calc(100vh-240px)] bg-white rounded-xl shadow-lg"
      >
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-gray-800 text-white sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 font-semibold text-center">#</th>
              <th className="px-3 py-3 font-semibold text-left">Order ID / Quotation</th>
              <th className="px-3 py-3 font-semibold text-left">Created By</th>
              <th className="px-3 py-3 font-semibold text-left">Order Date</th>
              <th className="px-3 py-3 font-semibold text-left">Company</th>
              <th className="px-3 py-3 font-semibold text-left">Item</th>
              <th className="px-3 py-3 font-semibold text-left">Payment Terms</th>
              <th className="px-3 py-3 font-semibold text-center">Status</th>
              <th className="px-3 py-3 font-semibold text-center">Payment</th>
              <th className="px-3 py-3 font-semibold text-center">Payment Pending</th>
              <th className="px-3 py-3 font-semibold text-center">Linked Payment</th>
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
                const pay = getPaymentBadge(deriveOrderListPaymentStatus(r));
                const paymentPending = getOrderListRemainingPayment(r);
                // const inst = getInstallationLabel(r.installation_status);
                return (
                  <tr
                    key={r.order_id}
                    className="hover:bg-gray-50 text-center transition-colors duration-150"
                  >
                    <td className="px-3 py-3">{i + 1}</td>
                    <td className="px-3 py-3 text-left">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-800">
                          {r.order_id}
                        </div>
                        <Link 
                          href={`/accounts-dashboard/quotations/${r.quote_number}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm"
                          title="View Quotation"
                        >
                          {r.quote_number}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-800">
                      {r.created_by}
                    </td>
                    <td className="px-3 py-3 text-left">
                      {dayjs(r.created_at).format("DD-MM-YYYY")}
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
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.textCol}`}
                      >
                        {status.icon} {status.text}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${pay.cls}`}
                      >
                        {pay.text}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {paymentPending == null ? (
                        <span className="text-gray-400 text-xs">—</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ₹{paymentPending.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <LinkedStatementPaymentCell order={r} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {dayjs(r.duedate).format("DD-MM-YYYY")}
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
            ) : showListLoadingEmpty ? (
              <tr>
                <td colSpan={13} className="px-6 py-8 text-center text-gray-600">
                  Loading…
                </td>
              </tr>
            ) : showNoOrdersEmpty ? (
              <tr>
                <td colSpan={13} className="px-6 py-4 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!listLoading && orders.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-600 px-1">
          <span>
            Showing {filteredOrders.length} of {orders.length} loaded
            {hasMore ? " — scroll for more" : " — all loaded"}
          </span>
          {loadingMore && (
            <span className="font-medium text-blue-600">Loading more…</span>
          )}
        </div>
      )}

      {/* 📱 CARD VIEW for mobile */}
      <div className="lg:hidden space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((r, i) => {
            const status = getStatusText(r);
            const paymentPending = getOrderListRemainingPayment(r);
            return (
              <div
                key={r.order_id}
                className="bg-white border border-gray-200 rounded-xl shadow-md p-4 space-y-2 text-sm"
              >
                <div className="flex justify-between items-center text-gray-500">
                  <span className="text-xs">#{i + 1}</span>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-800 mr-2">
                      {dayjs(r.created_at).format("DD-MM-YYYY")}
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
                  <strong>Order ID:</strong> {r.order_id}
                </div>
                <div>
                  <strong>Quotation:</strong>{" "}
                  <Link 
                    href={`/accounts-dashboard/quotations/${r.quote_number}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {r.quote_number}
                  </Link>
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
                  <strong>Payment Pending:</strong>{" "}
                  {paymentPending == null ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className="font-semibold text-red-600">
                      ₹
                      {paymentPending.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>
                <div className="pt-1">
                  <strong>Linked Payment:</strong>
                  <div className="mt-1 pl-1">
                    <LinkedStatementPaymentCell order={r} />
                  </div>
                </div>
              </div>
            );
          })
        ) : showListLoadingEmpty ? (
          <p className="text-center text-gray-600 py-8">Loading…</p>
        ) : showNoOrdersEmpty ? (
          <p className="text-center text-gray-500">No orders found.</p>
        ) : null}
      </div>
    </div>
  );
}

// 🔘 Modular Action Buttons (used in both views)
function ActionButtons({ r, userRole, isOpen, toggleMenu }) {
  if (r.is_cancelled) {
    return null;
  }

  const popRef = useRef(null);
  const [bookingProductSelectOpen, setBookingProductSelectOpen] = useState(false);
  const role = (userRole || "").toString().trim().toLowerCase();
  const canViewSales = [
    "back office",
    "accountant",
    "admin",
    "superadmin",
    "sales",
    "warehouse incharge",
    "gem portal",
    "team leader",
    "service head",
  ].includes(role);
  const isSuperAdmin = isSuperAdminRole(userRole);
  const isAdmin = role === "admin";
  const isAccountant = role.includes("accountant");
  const isTeamLeader = role === "team leader";
  const isWarehouse = role === "warehouse incharge";
  const canManageInvoiceDocs =
    isSuperAdmin || isAdmin || isAccountant || isTeamLeader;
  const canManageReturns = isSuperAdmin || isTeamLeader;
  const accountantOnlyMenu = isAccountantOnlyMenuRole(userRole);
  const canEditBooking = isSuperAdmin || isAdmin;
  const reportUploaded = isBookingAllowedForOrder(r);
  const canAdminAfterReport = (isAdmin || isSuperAdmin) && reportUploaded;
  const canManageBookingActions =
    isSuperAdmin ||
    isAdmin ||
    canManageReturns ||
    canAdminAfterReport ||
    ((isTeamLeader || isWarehouse) && reportUploaded);
  const hasBooking =
    r.booking_id !== undefined &&
    r.booking_id !== null &&
    String(r.booking_id).trim() !== "" &&
    String(r.booking_id) !== "0";
  const dispatchStatus = Number(r.dispatch_status);
  const followUpBooking = canCreateFollowUpBooking(r);
  const canOpenDispatch = canOpenDispatchForOrder(r);
  const remainDispatchRound = isRemainDispatchRound(r);
  const canViewDispatchPanel = canViewDispatchPanelForOrder(r);

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
      <DispatchProductSelectModal
        open={bookingProductSelectOpen}
        orderId={r.order_id}
        nextHref={`/accounts-dashboard/order/upload-booking/${r.order_id}`}
        onClose={() => setBookingProductSelectOpen(false)}
        title={
          followUpBooking
            ? "Select remaining products for booking"
            : "Select products for booking"
        }
        confirmLabel="Continue to booking"
        partialHint="Partial Dispatch"
      />
      {isOpen && (
        <div
          ref={popRef}
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black/5 z-20 border"
        >
          <div className="py-1 text-sm">
            {accountantOnlyMenu ? (
              <>
                <AccountantReportActionLinks
                  order={r}
                  viewSalesHref={`/user-dashboard/order/${r.order_id}`}
                  uploadHref={`/accounts-dashboard/order/upload/${r.order_id}`}
                  viewHref={`/accounts-dashboard/order/view/${r.order_id}`}
                  onClick={(e) => e.stopPropagation()}
                />
                <OrderBookingViewMenuLinks
                  order={r}
                  basePath="/accounts-dashboard/order"
                  canSee={hasBooking}
                  onClick={(e) => e.stopPropagation()}
                />
                <OrderInvoiceMenuLinks
                  order={r}
                  invoicesBasePath="/accounts-dashboard/invoices"
                  onClick={(e) => e.stopPropagation()}
                />
                {r.report_file && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <ViewPaymentButton order={r} />
                  </div>
                )}
                {canViewDispatchPanel && (
                  <Link
                    href={`/accounts-dashboard/order/dispatch/view/${r.order_id}`}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                    title="View Dispatch"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Search size={16} />
                    <span>View Dispatch</span>
                  </Link>
                )}
                <OrderDeliveryMenuLinks
                  order={r}
                  userRole={userRole}
                  DeliveryMenuItem={UpdateDeliveryMenuItem}
                />
                {dispatchStatus === 1 &&
                  ![1, 2, 3].includes(Number(r.is_returned || 0)) && (
                    <div
                      className="border-t border-gray-100 mt-1 pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ReturnInitiateMenuItem
                        order={r}
                        orderListPath="/accounts-dashboard/order"
                      />
                    </div>
                  )}
                <ViewCreditNoteMenuLink
                  order={r}
                  userRole={userRole}
                  hrefBase="/admin-dashboard"
                  onClick={(e) => e.stopPropagation()}
                />
                <AccountantReturnViewMenuItems
                  order={r}
                  onClick={(e) => e.stopPropagation()}
                />
                {canShowOrderCancelMenu(r) && (
                  <div
                    className="border-t border-gray-100 mt-1 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DeleteButton orderId={r.order_id} />
                  </div>
                )}
              </>
            ) : (
              <>
            {canViewSales && (
              <Link
                href={`/user-dashboard/order/${r.order_id}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                title="View Sales"
                onClick={(e) => e.stopPropagation()}
              >
                <ClipboardList size={16} />
                <span>View Sales</span>
              </Link>
            )}
            {canManageInvoiceDocs &&
              (r.report_file ? (
                <>
                  <Link
                    href={`/accounts-dashboard/order/view/${r.order_id}`}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                    title="View Report"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText size={16} />
                    <span>View Report</span>
                  </Link>
                  {(isSuperAdmin || isAdmin) && dispatchStatus === 0 && (
                    <Link
                      href={`/accounts-dashboard/order/upload/${r.order_id}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-blue-700"
                      title="Edit Report"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil size={16} />
                      <span>Edit Report</span>
                    </Link>
                  )}
                </>
              ) : (
                <div className="flex items-center">
                  <Link
                    href={`/accounts-dashboard/order/upload/${r.order_id}`}
                    className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-yellow-700"
                    title="Upload Report"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <UploadCloud size={16} />
                    <span>Upload Report</span>
                  </Link>
                  <div className="px-2">
                    {isSuperAdmin && <DeleteButton orderId={r.order_id} />}
                  </div>
                </div>
              ))}
            {canManageBookingActions &&
              (!hasBooking || followUpBooking) && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 text-green-700 text-left"
                  title={
                    followUpBooking
                      ? "Create booking for remaining products"
                      : "Create Booking"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setBookingProductSelectOpen(true);
                    toggleMenu();
                  }}
                >
                  <UploadCloud size={16} />
                  <span>
                    {followUpBooking
                      ? "Create Booking (Remaining)"
                      : "Create Booking"}
                  </span>
                </button>
              )}
            {canEditBooking &&
              hasBooking &&
              !followUpBooking &&
              !orderHasDispatchedStock(r) &&
              dispatchStatus !== 1 && (
              <Link
                href={`/accounts-dashboard/order/upload-booking/${r.order_id}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-blue-700"
                title="Edit Booking"
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil size={16} />
                <span>Edit Booking</span>
              </Link>
            )}
            <OrderBookingViewMenuLinks
              order={r}
              basePath="/accounts-dashboard/order"
              canSee={hasBooking && (canManageReturns || canEditBooking || isAccountant)}
              onClick={(e) => e.stopPropagation()}
            />
            {(isWarehouse || isSuperAdmin || isAdmin || canAdminAfterReport) &&
              canOpenDispatch && (
              <Link
                href={`/accounts-dashboard/order/dispatch/${r.order_id}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                title={
                  remainDispatchRound
                    ? "Dispatch remaining products"
                    : "Dispatch"
                }
                onClick={(e) => e.stopPropagation()}
              >
                <CheckCircle size={16} />
                <span>
                  {remainDispatchRound ? "Dispatch (Remain)" : "Dispatch"}
                </span>
              </Link>
            )}
            {(isWarehouse || canManageReturns || isAdmin || canViewSales) &&
              canViewDispatchPanel && (
              <Link
                href={`/accounts-dashboard/order/dispatch/view/${r.order_id}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                title="View Dispatch"
                onClick={(e) => e.stopPropagation()}
              >
                <Search size={16} />
                <span>View Dispatch</span>
              </Link>
            )}
            <OrderDeliveryMenuLinks
              order={r}
              userRole={userRole}
              DeliveryMenuItem={UpdateDeliveryMenuItem}
            />
            {canManageReturns &&
              dispatchStatus === 1 &&
              ![1, 2, 3].includes(Number(r.is_returned || 0)) && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <ReturnInitiateMenuItem
                  order={r}
                  orderListPath="/accounts-dashboard/order"
                />
              </div>
            )}
            {(canManageReturns || isAdmin) && Number(r.is_returned) === 3 && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <ReturnBookingMenuItem order={r} />
              </div>
            )}
            {(canManageReturns || isAdmin || isAccountant || isWarehouse) &&
              Number(r.return_booking_done) === 1 && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <ViewReturnBookingMenuItem order={r} />
              </div>
            )}
            <ViewCreditNoteMenuLink
              order={r}
              userRole={userRole}
              hrefBase="/admin-dashboard"
              onClick={(e) => e.stopPropagation()}
            />
            {(isSuperAdmin || isAdmin || isAccountant || isWarehouse) &&
              Number(r.warehouse_in_done) === 1 && (
              <div className="border-t border-gray-100 mt-1 pt-1" onClick={(e) => e.stopPropagation()}>
                <WarehouseInMenuItem order={r} />
              </div>
            )}
            {(isWarehouse || isAdmin) &&
              Number(r.is_returned) === 3 &&
              Number(r.return_booking_done) === 1 &&
              Number(r.warehouse_in_done) !== 1 && (
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

function ViewPaymentButton({ order }) {
  const [open, setOpen] = useState(false);
  const totalamt = order.totalamt || 0;
  const rows = buildOrderPaymentRows(order);

  const formatPrevDate = (d) => {
    if (!d) return "-";
    const v = dayjs(d);
    return v.isValid() ? v.format("DD-MM-YYYY") : d;
  };

  const totalPaid = sumOrderPaymentAmounts(order);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 text-left"
        title="View Payment"
      >
        <CreditCard size={16} />
        <span>View Payment</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
            <h3 className="font-semibold mb-3">View Payment</h3>
            <p>Total Amount : {totalamt}</p>
            <div className="space-y-3">
              <div className="text-xs text-gray-700">
                <div className="font-medium mb-1">Payments</div>
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
                  <div className="text-gray-500">No payments recorded</div>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Status:{" "}
                <span className="font-medium">
                  {order.payment_status || "-"}
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded border"
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

function UpdateDeliveryMenuItem({ order, userRole, variant = "auto" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [deliveredOn, setDeliveredOn] = useState("");
  const [deliveryProof, setDeliveryProof] = useState(null);
  const [deliveryRemark, setDeliveryRemark] = useState("");
  const [uploading, setUploading] = useState(false);
  const canViewDeliveryDetails = canViewOrderDeliveryDetailsRole(userRole);
  const superAdmin = isSuperAdminRole(userRole);
  const canManageAnyDelivery = canManageAnyOrderDeliveryRole(userRole);

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

  const isFullyDelivered = isOrderFullyDelivered(order);
  const hasDeliveryRecord = orderHasDeliveryRecord(order);

  const shouldShow = () => {
    if (!canShowOrderDeliveryActions(order)) return false;
    if (superAdmin || canManageAnyDelivery) return true;
    if (canViewDeliveryDetails) return hasDeliveryRecord;
    if (!currentUser || order.booking_by !== currentUser) return false;
    return true;
  };

  const viewOnly =
    !superAdmin &&
    !canManageAnyDelivery &&
    canViewDeliveryDetails &&
    hasDeliveryRecord;

  const handleSave = async () => {
    if (!deliveredOn) {
      alert("Please select delivery date");
      return;
    }

    try {
      setSaving(true);
      let deliveryProofUrl = null;

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

  if (variant === "view_first") {
    if (!canShowOrderDeliveryActions(order) || !hasDeliveryRecord) return null;
  } else if (variant === "view_remain") {
    if (
      !canShowOrderDeliveryActions(order) ||
      !orderHasSecondDeliveryBatch(order)
    ) {
      return null;
    }
  } else if (variant === "update_remain") {
    if (
      !canShowOrderDeliveryActions(order) ||
      isFullyDelivered ||
      !hasDeliveryRecord
    ) {
      return null;
    }
  } else if (variant === "view") {
    if (!canShowOrderDeliveryActions(order) || !hasDeliveryRecord) return null;
  } else if (variant === "update") {
    if (!canShowOrderDeliveryActions(order) || isFullyDelivered) return null;
  } else if (!shouldShow()) {
    return null;
  }

  const batchForModal =
    variant === "view_first"
      ? getDeliveryBatchForView(order, "first")
      : variant === "view_remain"
        ? getDeliveryBatchForView(order, "remain")
        : null;
  const displayOrder = batchForModal
    ? {
        ...order,
        delivered_on: batchForModal.delivered_on,
        delivery_proof: batchForModal.delivery_proof,
        delivery_remark: batchForModal.delivery_remark,
      }
    : order;

  const readOnlyDeliveryModal =
    variant === "view_first" ||
    variant === "view_remain" ||
    variant === "view" ||
    (variant === "auto" && (viewOnly || isFullyDelivered));

  const menuLabel =
    variant === "view_first"
      ? "View Delivery"
      : variant === "view_remain"
        ? "View Delivery (Remain)"
        : variant === "update_remain"
          ? "Update Delivery (Remain)"
          : variant === "update"
            ? "Update Delivery"
            : readOnlyDeliveryModal
              ? "View Delivery"
              : "Update Delivery";

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
        title={readOnlyDeliveryModal ? "View Delivery" : "Update Delivery Status"}
      >
        <Truck size={16} />
        <span>{menuLabel}</span>
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
              {readOnlyDeliveryModal
                ? variant === "view_remain"
                  ? "Delivery Details (Remain)"
                  : "Delivery Details"
                : variant === "update_remain"
                  ? "Update Delivery (Remain)"
                  : "Update Delivery Status"}
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

              {readOnlyDeliveryModal ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Actual Delivery Date:
                    </label>
                    <p className="text-sm font-medium text-gray-800">
                      {formatDate(displayOrder.delivered_on)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Delivery Proof:
                    </label>
                    {displayOrder.delivery_proof ? (
                      <div className="flex gap-3">
                        <a
                          href={displayOrder.delivery_proof}
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
                          href={displayOrder.delivery_proof}
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
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 font-medium mb-1">
                      Actual Delivery Date *
                    </label>
                    <TypeableDateFilterInput value={deliveredOn} onChange={setDeliveredOn} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required/>
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
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                {readOnlyDeliveryModal ? "Close" : "Cancel"}
              </button>
              {!readOnlyDeliveryModal && (
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

/** Order Cancel: allowed through booking done (incl. after invoice upload); hidden once dispatch starts. */
function canShowOrderCancelMenu(order) {
  if (!order || order.is_cancelled) return false;
  const dispatch = Number(order.dispatch_status);
  if (dispatch === 1 || dispatch === 2) return false;
  if (order.installation_status) return false;
  if (Number(order.is_returned || 0) !== 0) return false;
  if (isOrderFullyDelivered(order) || isOrderPartialDelivery(order)) return false;
  if (orderHasDispatchedStock(order)) return false;
  return true;
}
