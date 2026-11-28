"use client";

import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import Link from "next/link";
import dayjs from "dayjs";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Eye,
  CreditCard,
  Pencil,
  Link2,
  Edit3,
  Search,
  CalendarDays,
  ChevronDown,
  RotateCcw,
  ReceiptIndianRupee,
} from "lucide-react";
import Modal from "./Model";
import {
  ExpenseSbiSummaryCard,
  ExpenseApprovalStatusBadge,
  ExpenseRowImageAttachments,
  ExpenseTravelDetailsCell,
  ExpenseAmountApprovalCell,
  ExpenseLinkedStatementsCell,
  ExpenseStatusBadge,
  expenseSbiFilterInputClass,
  expenseSbiSelectClass,
} from "@/components/ServiceBeforeInstallation/ExpenseApprovalSbiUi";
import StatementLinkModal from "./StatementLinkModal";
import MultiStatementLinkModal from "./MultiStatementLinkModal";
import ExpenseSbiApprovalActions, {
  canManageExpenseApproval,
} from "@/components/ServiceBeforeInstallation/ExpenseSbiApprovalActions";

function isInactiveExpenseEmployee(row) {
  return Number(row?.employee_status) === 0;
}

function formatExpenseUsername(row) {
  const name = row?.username || "";
  if (!isInactiveExpenseEmployee(row)) return name;
  return (
    <>
      {name}
      <span className="ml-1 text-xs font-medium text-amber-700">(Inactive)</span>
    </>
  );
}

function formatExpenseTravelDate(value) {
  if (value == null || value === "" || value === "0000-00-00") return "-";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD-MM-YYYY") : "-";
}

function formatExpenseSubmitTimestamp(value) {
  if (value == null || value === "" || value === "0000-00-00") return "-";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD-MM-YYYY HH:mm") : "-";
}

function formatExpenseTravelMode(row) {
  const v = String(row.travel_mode || row.ConveyanceMode || "").trim();
  if (!v || v === "-") return "-";
  return v;
}

function expenseSummaryBucketMatches(row, bucket, { statusOf, isBlankAmount, isBlankDate }) {
  if (!bucket || bucket === "total") return true;
  const status = statusOf(row);
  switch (bucket) {
    case "rejected":
      return status === "rejected";
    case "approved":
      return status === "approved";
    case "pending_approval":
      return status === "pending" && isBlankAmount(row.approved_amount);
    case "pending_payment":
      return status === "approved" && isBlankDate(row.payment_date);
    case "paid":
      return status === "approved" && !isBlankDate(row.payment_date);
    default:
      return true;
  }
}

function ExpenseSummaryCard({
  label,
  amount,
  caption,
  borderClass,
  active,
  clickable,
  onClick,
}) {
  const shell = `bg-white p-4 rounded-lg shadow border-l-4 ${borderClass} text-left w-full`;
  const interactive = clickable
    ? ` cursor-pointer transition hover:shadow-md hover:-translate-y-0.5 ${
        active ? "ring-2 ring-offset-2 ring-slate-400/80" : ""
      }`
    : "";

  const inner = (
    <>
      <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-gray-800">₹{amount.toFixed(2)}</div>
      <div className="text-xs text-gray-500 mt-1">{caption}</div>
    </>
  );

  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={`${shell} ${interactive}`}>
        {inner}
      </button>
    );
  }

  return <div className={shell}>{inner}</div>;
}

export default function ExpenseTable({
  rows,
  role,
  approverUsername = "",
  clickableSummaryCards = false,
  uiVariant = "default",
}) {
  const isSbiUi = uiVariant === "sbi";
  const showSbiApprovalActions =
    isSbiUi && canManageExpenseApproval(role);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const dashboardBase = (() => {
    const match = pathname?.match(/^\/[\w-]+-dashboard/);
    return match ? match[0] : "/admin-dashboard";
  })();

  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [periodMonth, setPeriodMonth] = useState(dayjs().format("YYYY-MM"));
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState(new Set());

  // Function to update URL search params
  const updateQueryParam = useCallback((name, value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);

  // Sync with URL search params
  useEffect(() => {
    const userParam = searchParams.get("username");
    if (userParam) {
      setSelectedEmployee(userParam);
      // Inactive / ex-staff: show full expense history, not only the current month.
      setFromDate("");
      setToDate("");
    } else {
      setSelectedEmployee("");
    }
  }, [searchParams]);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [summaryBucket, setSummaryBucket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isMultiLinkModalOpen, setIsMultiLinkModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRowForLink, setSelectedRowForLink] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const getRowTotal = (row) =>
    Number(row.TicketCost || 0) +
    Number(row.HotelCost || 0) +
    Number(row.MealsCost || 0) +
    Number(row.OtherExpenses || 0);

  const refreshExpenseRows = useCallback(() => {
    router.refresh();
  }, [router]);

  const renderExpenseSecondaryActions = useCallback(
    (row) => (
      <>
        <Link
          href={`${dashboardBase}/expenses/${row.ID}`}
          className="text-blue-600 hover:underline"
          title="View expense"
        >
          <Eye size={16} />
        </Link>
        {row.approval_status !== "Approved" && row.approval_status !== "Rejected" ? (
          <Link
            href={`${dashboardBase}/expenses/edit/${row.ID}`}
            className="text-yellow-600 hover:text-yellow-800"
            title="Edit expense"
          >
            <Pencil size={16} />
          </Link>
        ) : row.approval_status === "Approved" ? (
          !row.linked_statement_ids ||
          JSON.parse(row.linked_statement_ids || "[]").length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setSelectedRowForLink(row);
                setIsLinkModalOpen(true);
              }}
              className="text-indigo-600 hover:text-indigo-800 cursor-pointer"
              title="Payment link"
            >
              <Link2 size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedRowForLink(row);
                setIsLinkModalOpen(true);
              }}
              className="text-blue-500 hover:text-blue-700 cursor-pointer"
              title="Edit payment link"
            >
              <Edit3 size={16} />
            </button>
          )
        ) : (
          <span className="inline-block w-4" aria-hidden />
        )}
        {role === "SUPERADMIN" ? (
          <button
            type="button"
            onClick={() => {
              if (row.approval_status !== "Approved") {
                alert("Please Approve the expense first");
                return;
              }
              setSelectedRow(row);
              setIsModalOpen(true);
            }}
            className="text-green-600 hover:text-green-800 cursor-pointer"
            title="Process payment"
          >
            <CreditCard size={16} />
          </button>
        ) : (
          <span className="inline-block w-4" aria-hidden />
        )}
      </>
    ),
    [dashboardBase, role],
  );

  const isBlankAmount = (value) =>
    value == null || value === "" || Number.isNaN(Number(value)) || Number(value) <= 0;

  const isBlankDate = (value) => !value || value === "0000-00-00";

  const statusOf = (row) => (row.approval_status || "").toLowerCase();

  const rowMatchesSearchAndDate = (row) => {
    const formattedDate = dayjs(row.TravelDate).format("DD-MM-YYYY");
    const matchesSearch =
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      formattedDate.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDateRange =
      (!fromDate || dayjs(row.TravelDate).isAfter(dayjs(fromDate).subtract(1, "day"))) &&
      (!toDate || dayjs(row.TravelDate).isBefore(dayjs(toDate).add(1, "day")));
    return matchesSearch && matchesDateRange;
  };

  const bucketHelpers = { statusOf, isBlankAmount, isBlankDate };

  const rowMatchesTableContext = (row) => {
    if (!rowMatchesSearchAndDate(row)) return false;
    if (clickableSummaryCards && summaryBucket) {
      return expenseSummaryBucketMatches(row, summaryBucket, bucketHelpers);
    }
    const matchesStatus = !selectedStatus || row.approval_status === selectedStatus;
    return matchesStatus;
  };

  const toggleSummaryCard = (bucketId) => {
    if (bucketId === "total") {
      setSummaryBucket(null);
      return;
    }
    setSummaryBucket((prev) => (prev === bucketId ? null : bucketId));
    setSelectedStatus("");
  };

  const employeePoolRows = clickableSummaryCards
    ? rows.filter(rowMatchesSearchAndDate)
    : rows.filter(rowMatchesTableContext);

  const employees = Array.from(new Set(employeePoolRows.map((row) => row.username)))
    .filter(Boolean)
    .sort((a, b) => String(a).trim().localeCompare(String(b).trim()));

  const employeeInactiveByUsername = new Map();
  for (const row of rows) {
    const key = String(row.username || "").trim();
    if (!key) continue;
    if (isInactiveExpenseEmployee(row)) employeeInactiveByUsername.set(key, true);
  }

  const filteredRows = rows.filter((row) => {
    const matchesEmployee =
      !selectedEmployee ||
      String(row.username || "").trim() === String(selectedEmployee).trim();
    return rowMatchesTableContext(row) && matchesEmployee;
  });

  const isDirector = (role || "").toUpperCase() === "DIRECTOR";

  const getApprovedValue = (row) =>
    row.approval_status === "Rejected" ? 0 : Number(row.approved_amount || 0);

  const calculateTotals = (data) => {
    const summary = {
      totalAmount: 0,
      totalCount: 0,
      rejectedAmount: 0,
      rejectedCount: 0,
      approvedAmount: 0,
      approvedCount: 0,
      pendingApprovalAmount: 0,
      pendingApprovalCount: 0,
      pendingPaymentAmount: 0,
      pendingPaymentCount: 0,
      paidAmount: 0,
      paidCount: 0,
    };

    data.forEach((row) => {
      const uploaded = getRowTotal(row);
      const approvedAmt = Number(row.approved_amount || 0);
      const status = statusOf(row);

      summary.totalAmount += uploaded;
      summary.totalCount += 1;

      if (status === "rejected") {
        summary.rejectedAmount += uploaded;
        summary.rejectedCount += 1;
      }

      if (status === "approved") {
        summary.approvedAmount += approvedAmt > 0 ? approvedAmt : uploaded;
        summary.approvedCount += 1;
      }

      if (status === "pending" && isBlankAmount(row.approved_amount)) {
        summary.pendingApprovalAmount += uploaded;
        summary.pendingApprovalCount += 1;
      }

      if (status === "approved" && isBlankDate(row.payment_date)) {
        summary.pendingPaymentAmount += approvedAmt > 0 ? approvedAmt : uploaded;
        summary.pendingPaymentCount += 1;
      }

      if (status === "approved" && !isBlankDate(row.payment_date)) {
        summary.paidAmount += approvedAmt > 0 ? approvedAmt : uploaded;
        summary.paidCount += 1;
      }
    });

    return summary;
  };

  const summaryRows = clickableSummaryCards
    ? rows.filter((row) => {
        const matchesEmployee =
          !selectedEmployee ||
          String(row.username || "").trim() === String(selectedEmployee).trim();
        return rowMatchesSearchAndDate(row) && matchesEmployee;
      })
    : filteredRows;

  const {
    totalAmount,
    totalCount,
    rejectedAmount,
    rejectedCount,
    approvedAmount,
    approvedCount,
    pendingApprovalAmount,
    pendingApprovalCount,
    pendingPaymentAmount,
    pendingPaymentCount,
    paidAmount,
    paidCount,
  } = calculateTotals(summaryRows);

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const key = sortConfig.key;

    const getVal = (row) => {
      switch (key) {
        case "ID":
          return Number(row.ID || 0);
        case "TravelDate":
          return row.TravelDate ? dayjs(row.TravelDate).valueOf() : 0;
        case "timestamp":
          return row.timestamp ? dayjs(row.timestamp).valueOf() : 0;
        case "expense_status":
          return (row.expense_status || "").toLowerCase();
        case "travel_mode":
          return formatExpenseTravelMode(row).toLowerCase();
        case "person_name":
          return (row.person_name || "").toLowerCase();
        case "person_contact":
          return (row.person_contact || "").toLowerCase();
        case "designation":
          return (row.designation || "").toLowerCase();
        case "username":
          return (row.username || "").toLowerCase();
        case "FromLocation":
          return (row.FromLocation || "").toLowerCase();
        case "Tolocation":
          return (row.Tolocation || "").toLowerCase();
        case "Total":
          return getRowTotal(row);
        case "approved_amount":
          return getApprovedValue(row);
        case "payment_date":
          return row.payment_date && row.payment_date !== "0000-00-00"
            ? dayjs(row.payment_date).valueOf()
            : 0;
        case "approval_status":
          return (row.approval_status || "").toLowerCase();
        default:
          return 0;
      }
    };

    const va = getVal(a);
    const vb = getVal(b);
    if (typeof va === "string" || typeof vb === "string") {
      return va.localeCompare(vb) * dir;
    }
    return (va - vb) * dir;
  });

  // Helper function to check if expense is settled
  const isExpenseSettled = (row) => {
    try {
      const linkedIds = JSON.parse(row.linked_statement_ids || "[]");
      return linkedIds.length > 0;
    } catch (e) {
      return false;
    }
  };

  const toggleExpenseSelection = (id, row) => {
    if (row.approval_status !== "Approved") {
      alert("Only approved expenses can be selected for linking");
      return;
    }
    if (isExpenseSettled(row)) {
      alert("Settled expenses cannot be selected");
      return;
    }
    setSelectedExpenseIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const eligibleRows = sortedRows.filter(row => 
      row.approval_status === "Approved" && !isExpenseSettled(row)
    );
    const currentlySelectedEligible = eligibleRows.filter(row => selectedExpenseIds.has(row.ID));
    if (currentlySelectedEligible.length === eligibleRows.length && eligibleRows.length > 0) {
      // Deselect only eligible ones
      setSelectedExpenseIds(prev => {
        const newSet = new Set(prev);
        eligibleRows.forEach(row => newSet.delete(row.ID));
        return newSet;
      });
    } else {
      // Select all eligible
      setSelectedExpenseIds(prev => {
        const newSet = new Set(prev);
        eligibleRows.forEach(row => newSet.add(row.ID));
        return newSet;
      });
    }
  };

  const calculateSelectedTotals = () => {
    let selectedTotalAmount = 0;
    let selectedApprovedAmount = 0;
    sortedRows.forEach(row => {
      if (selectedExpenseIds.has(row.ID)) {
        selectedTotalAmount += getRowTotal(row);
        const isRejected = row.approval_status === "Rejected";
        const rowApproved = Number(row.approved_amount || 0);
        if (!isRejected && rowApproved > 0) {
          selectedApprovedAmount += rowApproved;
        }
      }
    });
    return { selectedTotalAmount, selectedApprovedAmount };
  };

  const { selectedTotalAmount, selectedApprovedAmount } = calculateSelectedTotals();

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return <span className="ml-1">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>;
  };

  // Reset all filters
  const handleReset = () => {
    setSearchQuery("");
    setSelectedEmployee("");
    updateQueryParam("username", "");
    setSelectedStatus("");
    if (clickableSummaryCards) setSummaryBucket(null);
    const defaultMonth = dayjs().format("YYYY-MM");
    setPeriodMonth(defaultMonth);
    setFromDate(dayjs().startOf("month").format("YYYY-MM-DD"));
    setToDate(dayjs().endOf("month").format("YYYY-MM-DD"));
  };

  const periodMonthOptions = useMemo(() => {
    const list = [];
    const base = dayjs().startOf("month");
    for (let i = 0; i < 18; i += 1) {
      const d = base.subtract(i, "month");
      list.push({ value: d.format("YYYY-MM"), label: d.format("MMM YYYY") });
    }
    return list;
  }, []);

  const handlePeriodMonthChange = (value) => {
    setPeriodMonth(value);
    const d = dayjs(`${value}-01`);
    if (!d.isValid()) return;
    setFromDate(d.startOf("month").format("YYYY-MM-DD"));
    setToDate(d.endOf("month").format("YYYY-MM-DD"));
    if (clickableSummaryCards) setSummaryBucket(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRow(null);
  };

  const handlePaymentSuccess = () => {
    // You can update state or fetch the rows again to reflect the change in the table.
    // Example: setRows(updatedRows);
    closeModal(); // Close the modal
  };

  const handleLinkSuccess = () => {
    // Optionally refresh data if needed, but router.refresh() inside modal might handle it
  };

  const tableWrapperClass = isSbiUi
    ? "hidden md:block w-full overflow-auto border-y border-violet-100/80 bg-white"
    : "hidden md:block overflow-auto bg-white shadow rounded-lg";
  const sbiTableBleedClass = isSbiUi ? "-mx-4 sm:-mx-6" : "";

  const tableHeadClass = isSbiUi
    ? "bg-violet-50/90 sticky top-0 z-10"
    : "bg-gray-100 sticky top-0 z-10";

  const tableHeadRowClass = isSbiUi
    ? "text-left text-xs font-bold uppercase tracking-wide text-violet-900/90"
    : "text-left font-semibold text-gray-700";

  const tableBodyClass = isSbiUi
    ? "divide-y divide-violet-50 text-slate-800"
    : "text-gray-800 divide-y divide-gray-200";

  const tableRowClass = (idx) =>
    isSbiUi ? (idx % 2 === 0 ? "bg-white" : "bg-slate-50/60") : "";

  const engineerColumnLabel = isSbiUi ? "Engineer Name" : "Username";
  const allEngineersFilterLabel = isSbiUi ? "All Engineers" : "All Employees";
  const travelFromColumnLabel = isSbiUi ? "Travel From" : "From";
  const travelToColumnLabel = isSbiUi ? "Travel To" : "To";
  const travelDateColumnLabel = isSbiUi ? "Date of Completion Task" : "Date";
  const submitExpenseDateColumnLabel = isSbiUi ? "Date of Submit Expense" : null;
  const expAmountColumnLabel = isSbiUi ? "Exp Amount" : "Total";

  return (
    <div className={isSbiUi ? "space-y-5" : "space-y-4"}>
      {isSbiUi ? (
        <div className="flex flex-col gap-4 border-b border-violet-100/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 p-2.5 text-white shadow-lg shadow-violet-500/25">
              <ReceiptIndianRupee className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                Expense Approval Dashboard
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Review employee uploads, approvals, and pending payments
              </p>
            </div>
          </div>
          <div className="relative inline-flex w-full max-w-[11rem] items-center sm:w-auto">
            <CalendarDays
              className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-violet-600"
              aria-hidden
            />
            <select
              value={periodMonth}
              onChange={(e) => handlePeriodMonthChange(e.target.value)}
              className={`${expenseSbiSelectClass} w-full pl-10 font-semibold`}
              aria-label="Month"
            >
              {periodMonthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400"
              aria-hidden
            />
          </div>
        </div>
      ) : null}

      {/* Summary Cards */}
      <div
        className={
          isSbiUi
            ? `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isDirector ? "xl:grid-cols-6" : "xl:grid-cols-5"}`
            : `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${isDirector ? "xl:grid-cols-6" : "xl:grid-cols-5"} gap-4 mb-4`
        }
      >
        {isSbiUi ? (
          <>
            <ExpenseSbiSummaryCard
              bucketId="total"
              label="Total"
              amount={totalAmount}
              caption={`${totalCount} uploaded by engineers`}
              clickable={clickableSummaryCards}
              active={false}
              onClick={() => toggleSummaryCard("total")}
            />
            <ExpenseSbiSummaryCard
              bucketId="rejected"
              label="Rejected"
              amount={rejectedAmount}
              caption={`${rejectedCount} rejected`}
              clickable={clickableSummaryCards}
              active={summaryBucket === "rejected"}
              onClick={() => toggleSummaryCard("rejected")}
            />
            <ExpenseSbiSummaryCard
              bucketId="approved"
              label="Approved"
              amount={approvedAmount}
              caption={`${approvedCount} approved`}
              clickable={clickableSummaryCards}
              active={summaryBucket === "approved"}
              onClick={() => toggleSummaryCard("approved")}
            />
            <ExpenseSbiSummaryCard
              bucketId="pending_approval"
              label="Pending approval"
              amount={pendingApprovalAmount}
              caption={`${pendingApprovalCount} pending, amount blank`}
              clickable={clickableSummaryCards}
              active={summaryBucket === "pending_approval"}
              onClick={() => toggleSummaryCard("pending_approval")}
            />
            <ExpenseSbiSummaryCard
              bucketId="pending_payment"
              label="Pending to payment"
              amount={pendingPaymentAmount}
              caption={`${pendingPaymentCount} approved, not paid`}
              clickable={clickableSummaryCards}
              active={summaryBucket === "pending_payment"}
              onClick={() => toggleSummaryCard("pending_payment")}
            />
            {isDirector ? (
              <ExpenseSbiSummaryCard
                bucketId="paid"
                label="Paid"
                amount={paidAmount}
                caption={`${paidCount} paid`}
                clickable={clickableSummaryCards}
                active={summaryBucket === "paid"}
                onClick={() => toggleSummaryCard("paid")}
              />
            ) : null}
          </>
        ) : (
          <>
            <ExpenseSummaryCard
              label="Total"
              amount={totalAmount}
              caption={`${totalCount} uploaded by employees`}
              borderClass="border-blue-600"
              clickable={clickableSummaryCards}
              active={false}
              onClick={() => toggleSummaryCard("total")}
            />
            <ExpenseSummaryCard
              label="Rejected"
              amount={rejectedAmount}
              caption={`${rejectedCount} rejected`}
              borderClass="border-red-600"
              clickable={clickableSummaryCards}
              active={summaryBucket === "rejected"}
              onClick={() => toggleSummaryCard("rejected")}
            />
            <ExpenseSummaryCard
              label="Approved"
              amount={approvedAmount}
              caption={`${approvedCount} approved`}
              borderClass="border-green-600"
              clickable={clickableSummaryCards}
              active={summaryBucket === "approved"}
              onClick={() => toggleSummaryCard("approved")}
            />
            <ExpenseSummaryCard
              label="Pending approval"
              amount={pendingApprovalAmount}
              caption={`${pendingApprovalCount} pending, amount blank`}
              borderClass="border-yellow-600"
              clickable={clickableSummaryCards}
              active={summaryBucket === "pending_approval"}
              onClick={() => toggleSummaryCard("pending_approval")}
            />
            <ExpenseSummaryCard
              label="Pending to payment"
              amount={pendingPaymentAmount}
              caption={`${pendingPaymentCount} approved, not paid`}
              borderClass="border-orange-600"
              clickable={clickableSummaryCards}
              active={summaryBucket === "pending_payment"}
              onClick={() => toggleSummaryCard("pending_payment")}
            />
            {isDirector && (
              <ExpenseSummaryCard
                label="Paid"
                amount={paidAmount}
                caption={`${paidCount} paid`}
                borderClass="border-teal-600"
                clickable={clickableSummaryCards}
                active={summaryBucket === "paid"}
                onClick={() => toggleSummaryCard("paid")}
              />
            )}
          </>
        )}
        {selectedExpenseIds.size > 0 && (
          <div
            className={
              isSbiUi
                ? "rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm"
                : "bg-white p-4 rounded-lg shadow border-l-4 border-purple-600"
            }
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">
                  Selected Approved Amount
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  ₹{selectedApprovedAmount.toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => setIsMultiLinkModalOpen(true)}
                className="text-purple-600 hover:text-purple-800 cursor-pointer"
                title="Link Payment"
                type="button"
              >
                <Link2 size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div
        className={
          isSbiUi
            ? "flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:gap-3"
            : "flex flex-wrap items-center gap-2 sm:gap-4 mb-4"
        }
      >
        <div className="relative w-full min-w-[12rem] flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            placeholder="Search anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={
              isSbiUi ? expenseSbiFilterInputClass : "px-4 py-2 border rounded-lg w-full sm:w-auto"
            }
          />
        </div>
        <div className={isSbiUi ? "relative" : ""}>
          <select
            value={selectedEmployee}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedEmployee(val);
              updateQueryParam("username", val);
            }}
            className={isSbiUi ? expenseSbiSelectClass : "px-4 py-2 border rounded-lg w-full sm:w-auto"}
          >
            <option value="">{allEngineersFilterLabel}</option>
            {employees.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
                {employeeInactiveByUsername.has(String(emp).trim()) ? " (Inactive)" : ""}
              </option>
            ))}
          </select>
          {isSbiUi ? (
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          ) : null}
        </div>
        <div className={isSbiUi ? "relative" : ""}>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              if (clickableSummaryCards) setSummaryBucket(null);
            }}
            className={isSbiUi ? expenseSbiSelectClass : "px-4 py-2 border rounded-lg w-full sm:w-auto"}
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          {isSbiUi ? (
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span
            className={
              isSbiUi
                ? "text-xs font-semibold text-slate-500"
                : "text-sm text-gray-500 hidden sm:inline"
            }
          >
            From:
          </span>
          <TypeableDateFilterInput
            value={fromDate}
            onChange={setFromDate}
            className={
              isSbiUi
                ? "rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm w-full sm:w-auto"
                : "px-4 py-2 border rounded-lg w-full sm:w-auto"
            }
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span
            className={
              isSbiUi
                ? "text-xs font-semibold text-slate-500"
                : "text-sm text-gray-500 hidden sm:inline"
            }
          >
            To:
          </span>
          <TypeableDateFilterInput
            value={toDate}
            onChange={setToDate}
            className={
              isSbiUi
                ? "rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm w-full sm:w-auto"
                : "px-4 py-2 border rounded-lg w-full sm:w-auto"
            }
          />
        </div>
        <button
          type="button"
          onClick={handleReset}
          className={
            isSbiUi
              ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 sm:w-auto"
              : "px-4 py-2 bg-gray-300 rounded-lg text-sm cursor-pointer w-full sm:w-auto hover:bg-gray-400 transition-colors"
          }
        >
          {isSbiUi ? <RotateCcw className="h-4 w-4" aria-hidden /> : null}
          Reset
        </button>
      </div>
      <div className={sbiTableBleedClass}>
      {/* Desktop Table View */}
      <div className={tableWrapperClass}>
        <table className="min-w-full table-auto text-sm">
          <thead className={tableHeadClass}>
            <tr className={tableHeadRowClass}>
              <th className="p-3">
                <input
                  type="checkbox"
                  checked={sortedRows.filter(row => 
                    row.approval_status === "Approved" && 
                    !isExpenseSettled(row)
                  ).length > 0 && selectedExpenseIds.size === sortedRows.filter(row => 
                    row.approval_status === "Approved" && 
                    !isExpenseSettled(row)
                  ).length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
              <th onClick={() => handleSort("ID")} className="p-3 cursor-pointer select-none">ID<SortIcon column="ID" /></th>
              {isSbiUi ? (
                <>
                  <th
                    onClick={() => handleSort("timestamp")}
                    className="min-w-[11.5rem] whitespace-nowrap p-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {submitExpenseDateColumnLabel}
                      <SortIcon column="timestamp" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("username")}
                    className="min-w-[9.5rem] whitespace-nowrap p-3 cursor-pointer select-none pr-4"
                  >
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {engineerColumnLabel}
                      <SortIcon column="username" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("expense_status")}
                    className="min-w-[7rem] whitespace-nowrap p-3 cursor-pointer select-none"
                  >
                    Expense Status
                    <SortIcon column="expense_status" />
                  </th>
                  <th
                    onClick={() => handleSort("Total")}
                    className="min-w-[10rem] max-w-[14rem] p-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      Amount &amp; Approval
                      <SortIcon column="Total" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("FromLocation")}
                    className="min-w-[10rem] max-w-[15rem] p-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      Travel Details
                      <SortIcon column="FromLocation" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("TravelDate")}
                    className="min-w-[7.5rem] whitespace-nowrap p-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {travelDateColumnLabel}
                      <SortIcon column="TravelDate" />
                    </span>
                  </th>
                  <th onClick={() => handleSort("payment_date")} className="p-3 cursor-pointer select-none">
                    Payment Date
                    <SortIcon column="payment_date" />
                  </th>
                  <th onClick={() => handleSort("approval_status")} className="p-3 cursor-pointer select-none">
                    Status
                    <SortIcon column="approval_status" />
                  </th>
                  <th className="min-w-[5.5rem] whitespace-nowrap p-3">Image</th>
                </>
              ) : (
                <>
                  <th
                    onClick={() => handleSort("TravelDate")}
                    className="p-3 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {travelDateColumnLabel}
                      <SortIcon column="TravelDate" />
                    </span>
                  </th>
                  <th onClick={() => handleSort("username")} className="p-3 cursor-pointer select-none">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {engineerColumnLabel}
                      <SortIcon column="username" />
                    </span>
                  </th>
                  <th onClick={() => handleSort("FromLocation")} className="p-3 cursor-pointer select-none">
                    {travelFromColumnLabel}
                    <SortIcon column="FromLocation" />
                  </th>
                  <th onClick={() => handleSort("Tolocation")} className="p-3 cursor-pointer select-none">
                    {travelToColumnLabel}
                    <SortIcon column="Tolocation" />
                  </th>
                  <th onClick={() => handleSort("Total")} className="p-3 cursor-pointer select-none">
                    {expAmountColumnLabel}
                    <SortIcon column="Total" />
                  </th>
                  <th onClick={() => handleSort("approved_amount")} className="p-3 cursor-pointer select-none">
                    Approved Amt
                    <SortIcon column="approved_amount" />
                  </th>
                  <th className="p-3">Approved By</th>
                  <th onClick={() => handleSort("payment_date")} className="p-3 cursor-pointer select-none">
                    Payment Date
                    <SortIcon column="payment_date" />
                  </th>
                  <th onClick={() => handleSort("approval_status")} className="p-3 cursor-pointer select-none">
                    Status
                    <SortIcon column="approval_status" />
                  </th>
                </>
              )}
              <th className={isSbiUi ? "min-w-[9rem] p-3" : "p-3"}>Linked Statements</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className={tableBodyClass}>
            {sortedRows.length > 0 ? (
              sortedRows.map((row, rowIdx) => {
                const totalCost =
                  Number(row.TicketCost || 0) +
                  Number(row.HotelCost || 0) +
                  Number(row.MealsCost || 0) +
                  Number(row.OtherExpenses || 0);

                return (
                  <tr key={row.ID} className={tableRowClass(rowIdx)}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedExpenseIds.has(row.ID)}
                        onChange={() => toggleExpenseSelection(row.ID, row)}
                        className="w-4 h-4 cursor-pointer"
                        disabled={row.approval_status !== "Approved" || isExpenseSettled(row)}
                      />
                    </td>
                    <td className="p-3">{row.ID}</td>
                    {isSbiUi ? (
                      <>
                        <td className="whitespace-nowrap p-3 text-xs tabular-nums sm:text-sm">
                          {formatExpenseSubmitTimestamp(row.timestamp)}
                        </td>
                        <td className="min-w-[9.5rem] whitespace-nowrap p-3">
                          {formatExpenseUsername(row)}
                        </td>
                        <td className="p-3">
                          <ExpenseStatusBadge status={row.expense_status} />
                        </td>
                        <td className="p-3 align-top">
                          <ExpenseAmountApprovalCell
                            expAmount={`₹${totalCost.toFixed(2)}`}
                            approvedAmount={
                              row.approval_status === "Rejected" ||
                              !(Number(row.approved_amount) > 0)
                                ? "-"
                                : `₹${Number(row.approved_amount).toFixed(2)}`
                            }
                            approvedBy={row.approved_by}
                          />
                        </td>
                        <td className="p-3 align-top">
                          <ExpenseTravelDetailsCell
                            travelFrom={row.FromLocation}
                            travelTo={row.Tolocation}
                            travelMode={formatExpenseTravelMode(row)}
                          />
                        </td>
                        <td className="whitespace-nowrap p-3">
                          {formatExpenseTravelDate(row.TravelDate)}
                        </td>
                        <td className="p-3">
                          {row.payment_date && row.payment_date !== "0000-00-00"
                            ? dayjs(row.payment_date).format("DD-MM-YYYY")
                            : "-"}
                        </td>
                        <td className="p-3">
                          <ExpenseApprovalStatusBadge status={row.approval_status} />
                        </td>
                        <td className="w-14 min-w-14 max-w-14 p-2 align-middle">
                          <ExpenseRowImageAttachments
                            attachmentsRaw={row.attachments}
                            variant="table"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3">{formatExpenseTravelDate(row.TravelDate)}</td>
                        <td className="p-3">{formatExpenseUsername(row)}</td>
                        <td className="p-3">{row.FromLocation}</td>
                        <td className="p-3">{row.Tolocation}</td>
                        <td className="p-3">₹{totalCost.toFixed(2)}</td>
                        <td className="p-3">
                          {row.approval_status === "Rejected" ||
                          !(Number(row.approved_amount) > 0)
                            ? "-"
                            : `₹${Number(row.approved_amount).toFixed(2)}`}
                        </td>
                        <td className="p-3">{row.approved_by || "-"}</td>
                        <td className="p-3">
                          {row.payment_date && row.payment_date !== "0000-00-00"
                            ? dayjs(row.payment_date).format("DD-MM-YYYY")
                            : "-"}
                        </td>
                        <td className="p-3">{row.approval_status}</td>
                      </>
                    )}
                    <td className="p-3 align-top">
                      <ExpenseLinkedStatementsCell
                        linkedStatementIdsRaw={row.linked_statement_ids}
                        statementBasePath={dashboardBase}
                        variant={isSbiUi ? "sbi" : "default"}
                      />
                    </td>
                    <td className="min-w-[9rem] p-3 align-top">
                      {showSbiApprovalActions ? (
                        <div className="inline-flex flex-col gap-1.5">
                          <ExpenseSbiApprovalActions
                            expenseId={row.ID}
                            totalAmount={totalCost}
                            approvalStatus={row.approval_status}
                            approverUsername={approverUsername}
                            onSuccess={refreshExpenseRows}
                          />
                          <div className="flex items-center gap-2">
                            {renderExpenseSecondaryActions(row)}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {renderExpenseSecondaryActions(row)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={isSbiUi ? 13 : 13}
                  className="p-4 text-center text-gray-500"
                >
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4">
        {sortedRows.length === 0 && (
          <div className="text-center text-gray-500">No entries found.</div>
        )}

        {sortedRows.map((row) => {
          const totalCost =
            Number(row.TicketCost || 0) +
            Number(row.HotelCost || 0) +
            Number(row.MealsCost || 0) +
            Number(row.OtherExpenses || 0);

          return (
            <div
              key={row.ID}
              className="border rounded-lg p-4 shadow-sm bg-white text-sm space-y-1"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedExpenseIds.has(row.ID)}
                  onChange={() => toggleExpenseSelection(row.ID, row)}
                  className="w-4 h-4 cursor-pointer"
                  disabled={row.approval_status !== "Approved" || isExpenseSettled(row)}
                />
                <strong>ID:</strong> {row.ID}
              </div>
              {!isSbiUi ? (
                <div>
                  <strong>Date:</strong> {formatExpenseTravelDate(row.TravelDate)}
                </div>
              ) : null}
              {isSbiUi ? (
                <div>
                  <strong>Date of Submit Expense:</strong>{" "}
                  {formatExpenseSubmitTimestamp(row.timestamp)}
                </div>
              ) : null}
              {isSbiUi ? (
                <div>
                  <strong>Engineer Name:</strong> {formatExpenseUsername(row)}
                </div>
              ) : null}
              {isSbiUi ? (
                <div>
                  <strong>Expense Status:</strong>{" "}
                  <ExpenseStatusBadge status={row.expense_status} />
                </div>
              ) : null}
              {isSbiUi ? (
                <ExpenseAmountApprovalCell
                  expAmount={`₹${totalCost.toFixed(2)}`}
                  approvedAmount={
                    row.approval_status === "Rejected" ||
                    !(Number(row.approved_amount) > 0)
                      ? "-"
                      : `₹${Number(row.approved_amount).toFixed(2)}`
                  }
                  approvedBy={row.approved_by}
                />
              ) : (
                <div>
                  <strong>Total:</strong> ₹{totalCost.toFixed(2)}
                </div>
              )}
              {!isSbiUi ? (
                <>
                  <div>
                    <strong>Approved Amt:</strong>{" "}
                    {row.approval_status === "Rejected" ||
                    !(Number(row.approved_amount) > 0)
                      ? "-"
                      : `₹${Number(row.approved_amount).toFixed(2)}`}
                  </div>
                  <div>
                    <strong>Approved By:</strong> {row.approved_by || "-"}
                  </div>
                </>
              ) : null}
              {isSbiUi ? (
                <>
                  <ExpenseTravelDetailsCell
                    travelFrom={row.FromLocation}
                    travelTo={row.Tolocation}
                    travelMode={formatExpenseTravelMode(row)}
                  />
                  <div>
                    <strong>Date of Completion Task:</strong>{" "}
                    {formatExpenseTravelDate(row.TravelDate)}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>From:</strong> {row.FromLocation}
                  </div>
                  <div>
                    <strong>To:</strong> {row.Tolocation}
                  </div>
                </>
              )}
              <div>
                <strong>Payment Date:</strong>{" "}
                {row.payment_date && row.payment_date !== "0000-00-00"
                  ? dayjs(row.payment_date).format("DD-MM-YYYY")
                  : "-"}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                {isSbiUi ? (
                  <ExpenseApprovalStatusBadge status={row.approval_status} />
                ) : (
                  row.approval_status
                )}
              </div>
              {isSbiUi ? (
                <div className="flex items-center gap-2">
                  <strong>Image:</strong>
                  <ExpenseRowImageAttachments
                    attachmentsRaw={row.attachments}
                    variant="table"
                  />
                </div>
              ) : null}
              <div>
                <strong className="block pb-1">Linked Statements</strong>
                <ExpenseLinkedStatementsCell
                  linkedStatementIdsRaw={row.linked_statement_ids}
                  statementBasePath={dashboardBase}
                  variant={isSbiUi ? "sbi" : "default"}
                />
              </div>
              <div className="pt-2">
                {showSbiApprovalActions ? (
                  <div className="inline-flex flex-col gap-1.5">
                    <ExpenseSbiApprovalActions
                      expenseId={row.ID}
                      totalAmount={totalCost}
                      approvalStatus={row.approval_status}
                      approverUsername={approverUsername}
                      onSuccess={refreshExpenseRows}
                    />
                    <div className="flex items-center gap-2">
                      {renderExpenseSecondaryActions(row)}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {renderExpenseSecondaryActions(row)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isSbiUi ? (
        <p className="px-4 pt-3 text-sm font-medium text-slate-500 sm:px-6">
          {sortedRows.length === 0
            ? "Showing 0 entries"
            : `Showing 1 to ${sortedRows.length} of ${sortedRows.length} entries`}
        </p>
      ) : null}
      </div>

      <Modal
        isOpen={isModalOpen}
        closeModal={closeModal}
        row={selectedRow}
        role={role}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <StatementLinkModal
        isOpen={isLinkModalOpen}
        closeModal={() => setIsLinkModalOpen(false)}
        row={selectedRowForLink}
        onLinkSuccess={handleLinkSuccess}
      />

      <MultiStatementLinkModal
        isOpen={isMultiLinkModalOpen}
        closeModal={() => setIsMultiLinkModalOpen(false)}
        selectedExpenseIds={selectedExpenseIds}
        selectedApprovedAmount={selectedApprovedAmount}
        onLinkSuccess={() => setSelectedExpenseIds(new Set())}
      />
    </div>
  );
}
