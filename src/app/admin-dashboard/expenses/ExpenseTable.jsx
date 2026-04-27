"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useState } from "react";
import { Eye, CreditCard, Pencil } from "lucide-react";
import Modal from "./Model";

export default function ExpenseTable({ rows, role }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Get unique employees for the filter
  const employees = Array.from(new Set(rows.map((row) => row.username))).filter(Boolean).sort();

  // Filter rows based on the search query, employee, date range, and status
  const filteredRows = rows.filter((row) => {
    const totalCost =
      Number(row.TicketCost || 0) +
      Number(row.HotelCost || 0) +
      Number(row.MealsCost || 0) +
      Number(row.OtherExpenses || 0);

    const formattedDate = dayjs(row.TravelDate).format("DD MMM YYYY");

    // Check if any field matches the search query
    const matchesSearch =
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      formattedDate.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEmployee = !selectedEmployee || row.username === selectedEmployee;

    const matchesStatus = !selectedStatus || row.approval_status === selectedStatus;

    const matchesDateRange =
      (!fromDate || dayjs(row.TravelDate).isAfter(dayjs(fromDate).subtract(1, "day"))) &&
      (!toDate || dayjs(row.TravelDate).isBefore(dayjs(toDate).add(1, "day")));

    return matchesSearch && matchesEmployee && matchesStatus && matchesDateRange;
  });

  const calculateTotals = (data) => {
    let totalAmount = 0;
    let approvedAmount = 0;

    data.forEach((row) => {
      totalAmount +=
        Number(row.TicketCost || 0) +
        Number(row.HotelCost || 0) +
        Number(row.MealsCost || 0) +
        Number(row.OtherExpenses || 0);
      const isRejected = row.approval_status === "Rejected";
      const rowApproved = Number(row.approved_amount || 0);
      if (!isRejected && rowApproved > 0) {
        approvedAmount += rowApproved;
      }
    });

    return { totalAmount, approvedAmount };
  };

  const { totalAmount, approvedAmount } = calculateTotals(filteredRows);

  const getRowTotal = (row) =>
    Number(row.TicketCost || 0) +
    Number(row.HotelCost || 0) +
    Number(row.MealsCost || 0) +
    Number(row.OtherExpenses || 0);

  const getApprovedValue = (row) =>
    row.approval_status === "Rejected" ? 0 : Number(row.approved_amount || 0);

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

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return <span className="ml-1">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>;
  };

  // Reset all filters
  const handleReset = () => {
    setSearchQuery("");
    setSelectedEmployee("");
    setSelectedStatus("");
    setFromDate(dayjs().startOf("month").format("YYYY-MM-DD"));
    setToDate(dayjs().endOf("month").format("YYYY-MM-DD"));
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

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-600">
          <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">Total Amount</div>
          <div className="text-2xl font-bold text-gray-800">₹{totalAmount.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-600">
          <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">Approved Amount</div>
          <div className="text-2xl font-bold text-gray-800">₹{approvedAmount.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-600">
          <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">Pending Amount</div>
          <div className="text-2xl font-bold text-gray-800">₹{(totalAmount - approvedAmount).toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4">
        <input
          type="text"
          placeholder="Search anything..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto"
        />
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto"
        >
          <option value="">All Employees</option>
          {employees.map((emp) => (
            <option key={emp} value={emp}>
              {emp}
            </option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto"
        >
          <option value="">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-sm text-gray-500 hidden sm:inline">From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-4 py-2 border rounded-lg w-full sm:w-auto"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-sm text-gray-500 hidden sm:inline">To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-4 py-2 border rounded-lg w-full sm:w-auto"
          />
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-300 rounded-lg text-sm cursor-pointer w-full sm:w-auto hover:bg-gray-400 transition-colors"
        >
          Reset
        </button>
      </div>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-auto bg-white shadow rounded-lg">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr className="text-left font-semibold text-gray-700">
              <th onClick={() => handleSort("ID")} className="p-3 cursor-pointer select-none">ID<SortIcon column="ID" /></th>
              <th onClick={() => handleSort("TravelDate")} className="p-3 cursor-pointer select-none">Date<SortIcon column="TravelDate" /></th>
              <th onClick={() => handleSort("username")} className="p-3 cursor-pointer select-none">Username<SortIcon column="username" /></th>
              <th onClick={() => handleSort("FromLocation")} className="p-3 cursor-pointer select-none">From<SortIcon column="FromLocation" /></th>
              <th onClick={() => handleSort("Tolocation")} className="p-3 cursor-pointer select-none">To<SortIcon column="Tolocation" /></th>
              <th onClick={() => handleSort("Total")} className="p-3 cursor-pointer select-none">Total<SortIcon column="Total" /></th>
              <th onClick={() => handleSort("approved_amount")} className="p-3 cursor-pointer select-none">Approved Amt<SortIcon column="approved_amount" /></th>
              <th onClick={() => handleSort("payment_date")} className="p-3 cursor-pointer select-none">Payment Date<SortIcon column="payment_date" /></th>
              <th onClick={() => handleSort("approval_status")} className="p-3 cursor-pointer select-none">Status<SortIcon column="approval_status" /></th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 divide-y divide-gray-200">
            {sortedRows.length > 0 ? (
              sortedRows.map((row) => {
                const totalCost =
                  Number(row.TicketCost || 0) +
                  Number(row.HotelCost || 0) +
                  Number(row.MealsCost || 0) +
                  Number(row.OtherExpenses || 0);

                return (
                  <tr key={row.ID}>
                    <td className="p-3">{row.ID}</td>
                    <td className="p-3">
                      {row.TravelDate
                        ? dayjs(row.TravelDate).format("DD MMM YYYY")
                        : "-"}
                    </td>
                    <td className="p-3">{row.username}</td>
                    <td className="p-3">{row.FromLocation}</td>
                    <td className="p-3">{row.Tolocation}</td>
                    <td className="p-3">₹{totalCost.toFixed(2)}</td>
                    <td className="p-3">
                      {row.approval_status === "Rejected" ||
                      !(Number(row.approved_amount) > 0)
                        ? "-"
                        : `₹${Number(row.approved_amount).toFixed(2)}`}
                    </td>
                    <td className="p-3">
                      {row.payment_date && row.payment_date !== "0000-00-00"
                        ? dayjs(row.payment_date).format("DD MMM YYYY")
                        : "-"}
                    </td>
                    <td className="p-3">{row.approval_status}</td>
                    <td className="p-3 flex gap-2 items-center">
                      <Link
                        href={`/admin-dashboard/expenses/${row.ID}`}
                        className="text-blue-600 hover:underline"
                      >
                        <Eye size={16} />
                      </Link>
                      {row.approval_status !== "Approved" && row.approval_status !== "Rejected" && (
                        <Link
                          href={`/admin-dashboard/expenses/edit/${row.ID}`}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="Edit Expense"
                        >
                          <Pencil size={16} />
                        </Link>
                      )}
                      {role === "SUPERADMIN" && (
                        <button
                          onClick={() => {
                            if (row.approval_status !== "Approved") {
                              alert("Please Approve the expense first");
                              return; // Stop execution here
                            }
                            setSelectedRow(row); // Store the selected row
                            setIsModalOpen(true); // Open the modal
                          }}
                          className="text-green-600 hover:text-green-800 cursor-pointer"
                        >
                          <CreditCard size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="p-4 text-center text-gray-500">
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
              <div>
                <strong>ID:</strong> {row.ID}
              </div>
              <div>
                <strong>Date:</strong>{" "}
                {row.TravelDate
                  ? dayjs(row.TravelDate).format("DD MMM YYYY")
                  : "-"}
              </div>
              <div>
                <strong>From:</strong> {row.FromLocation}
              </div>
              <div>
                <strong>To:</strong> {row.Tolocation}
              </div>
              <div>
                <strong>Total:</strong> ₹{totalCost.toFixed(2)}
              </div>
              <div>
                <strong>Approved Amt:</strong>{" "}
                {row.approval_status === "Rejected" ||
                !(Number(row.approved_amount) > 0)
                  ? "-"
                  : `₹${Number(row.approved_amount).toFixed(2)}`}
              </div>
              <div>
                <strong>Payment Date:</strong>{" "}
                {row.payment_date && row.payment_date !== "0000-00-00"
                  ? dayjs(row.payment_date).format("DD MMM YYYY")
                  : "-"}
              </div>
              <div>
                <strong>Status:</strong> {row.approval_status}
              </div>
              <div className="flex items-center gap-4 pt-2">
                <Link
                  href={`/admin-dashboard/expenses/${row.ID}`}
                  className="text-blue-600 hover:underline"
                >
                  <Eye size={16} />
                </Link>
                {row.approval_status !== "Approved" && row.approval_status !== "Rejected" && (
                  <Link
                    href={`/admin-dashboard/expenses/edit/${row.ID}`}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Edit Expense"
                  >
                    <Pencil size={16} />
                  </Link>
                )}
                {role === "SUPERADMIN" && (
                  <button
                    onClick={() => {
                      if (row.approval_status !== "Approved") {
                        alert("Please Approve the expense first");
                        return; // Stop execution here
                      }
                      setSelectedRow(row); // Store the selected row
                      setIsModalOpen(true); // Open the modal
                    }}
                    className="text-green-600 hover:text-green-800 cursor-pointer"
                  >
                    <CreditCard size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        closeModal={closeModal}
        row={selectedRow}
        role={role}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
