"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { Eye, CreditCard, Download, ExternalLink, Pencil } from "lucide-react";
import Modal from "../expenses/Model";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

export default function ExpenseTable({ rows, role }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Load filter values from localStorage if available
  useEffect(() => {
    const savedSearchQuery = localStorage.getItem("searchQuery");
    const savedFromDate = localStorage.getItem("fromDate");
    const savedToDate = localStorage.getItem("toDate");

    if (savedSearchQuery) setSearchQuery(savedSearchQuery);
    if (savedFromDate) setFromDate(savedFromDate);
    if (savedToDate) setToDate(savedToDate);
  }, []);

  // Save filter values to localStorage whenever they change
  useEffect(() => {
    if (searchQuery) localStorage.setItem("searchQuery", searchQuery);
    if (fromDate) localStorage.setItem("fromDate", fromDate);
    if (toDate) localStorage.setItem("toDate", toDate);
  }, [searchQuery, fromDate, toDate]);

  // Filter rows based on the search query, from date, and to date
  const filteredRows = rows.filter((row) => {
    const formattedDate = dayjs(row.TravelDate).format("DD MMM YYYY");

    // Check if any field matches the search query
    const matchesSearch =
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      formattedDate.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDateRange =
      (!fromDate || dayjs(row.TravelDate).isAfter(dayjs(fromDate))) &&
      (!toDate || dayjs(row.TravelDate).isBefore(dayjs(toDate)));

    return matchesSearch && matchesDateRange;
  });

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

  // Calculate totals for Total and Approved Amt (exclude rejected from approved)
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

    return {
      totalAmount,
      approvedAmount,
    };
  };

  const { totalAmount, approvedAmount } = calculateTotals(filteredRows);

  // Reset all filters
  const handleReset = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    localStorage.removeItem("searchQuery");
    localStorage.removeItem("fromDate");
    localStorage.removeItem("toDate");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRow(null);
  };

  const handlePaymentSuccess = () => {
    closeModal();
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const tableData = filteredRows.map((row) => [
      row.ID,
      dayjs(row.TravelDate).format("DD MMM YYYY"),
      row.username,
      row.FromLocation,
      row.Tolocation,
      `₹${(
        Number(row.TicketCost || 0) +
        Number(row.HotelCost || 0) +
        Number(row.MealsCost || 0) +
        Number(row.OtherExpenses || 0)
      ).toFixed(2)}`,
      row.approval_status === "Rejected" || !(Number(row.approved_amount) > 0)
        ? "-"
        : `₹${Number(row.approved_amount).toFixed(2)}`,
      row.payment_date && row.payment_date !== "0000-00-00"
        ? dayjs(row.payment_date).format("DD MMM YYYY")
        : "-",
      row.approval_status,
    ]);
    autoTable(doc, {
      head: [
        [
          "ID",
          "Date",
          "User Name",
          "From",
          "To",
          "Total",
          "Approved Amt",
          "Payment Date",
          "Status",
        ],
      ],
      body: tableData,
    });
    doc.save("expenses.pdf");
    setIsDropdownOpen(false);
  };

  const generateExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Expenses");
    worksheet.columns = [
      { header: "ID", key: "ID", width: 10 },
      { header: "Date", key: "TravelDate", width: 20 },
      { header: "User Name", key: "username", width: 20 },
      { header: "From", key: "FromLocation", width: 20 },
      { header: "To", key: "Tolocation", width: 20 },
      { header: "Total", key: "Total", width: 15 },
      { header: "Approved Amt", key: "approved_amount", width: 20 },
      { header: "Payment Date", key: "payment_date", width: 20 },
      { header: "Status", key: "approval_status", width: 15 },
    ];
    filteredRows.forEach((row) => {
      const totalCost =
        Number(row.TicketCost || 0) +
        Number(row.HotelCost || 0) +
        Number(row.MealsCost || 0) +
        Number(row.OtherExpenses || 0);
      worksheet.addRow({
        ID: row.ID,
        TravelDate: dayjs(row.TravelDate).format("DD MMM YYYY"),
        username: row.username,
        FromLocation: row.FromLocation,
        Tolocation: row.Tolocation,
        Total: `₹${totalCost.toFixed(2)}`,
        approved_amount:
          row.approval_status === "Rejected" || !(Number(row.approved_amount) > 0)
            ? "-"
            : `₹${Number(row.approved_amount).toFixed(2)}`,
        payment_date:
          row.payment_date && row.payment_date !== "0000-00-00"
            ? dayjs(row.payment_date).format("DD MMM YYYY")
            : "-",
        approval_status: row.approval_status,
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "expenses.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDropdownOpen(false);
  };

  const handlePaymentClick = (row) => {
    if (row.approval_status !== "Approved") {
      alert("Please Approve the expense first");
      return;
    }
    setSelectedRow(row);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
        <input
          type="text"
          placeholder="Search anything..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 rounded-lg text-sm cursor-pointer w-full sm:w-auto hover:bg-gray-300 transition"
        >
          Reset
        </button>
        <div className="relative w-full sm:w-auto">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition"
          >
            <Download size={16} className="mr-2" />
            Download
          </button>
          {isDropdownOpen && (
            <div className="absolute top-full left-0 w-full sm:w-32 bg-white shadow-lg rounded-lg mt-2 z-20">
              <button
                onClick={generatePDF}
                className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 flex items-center gap-2"
              >
                PDF
              </button>
              <button
                onClick={generateExcel}
                className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 flex items-center gap-2"
              >
                Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-auto bg-white shadow rounded-lg">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr className="text-left font-semibold text-gray-700">
              <th onClick={() => handleSort("ID")} className="p-3 cursor-pointer select-none">ID<SortIcon column="ID" /></th>
              <th onClick={() => handleSort("TravelDate")} className="p-3 cursor-pointer select-none">Date<SortIcon column="TravelDate" /></th>
              <th onClick={() => handleSort("username")} className="p-3 cursor-pointer select-none">User Name<SortIcon column="username" /></th>
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
              <>
                {sortedRows.map((row) => {
                  const totalCost =
                    Number(row.TicketCost || 0) +
                    Number(row.HotelCost || 0) +
                    Number(row.MealsCost || 0) +
                    Number(row.OtherExpenses || 0);

                  return (
                    <tr
                      key={row.ID}
                      className="hover:bg-gray-50 transition-colors"
                    >
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
                          href={`/user-dashboard/expenses/${row.ID}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </Link>
                        {row.approval_status !== "Approved" && row.approval_status !== "Rejected" && (
                          <Link
                            href={`/user-dashboard/expenses/edit/${row.ID}`}
                            className="text-yellow-600 hover:text-yellow-800"
                            title="Edit Expense"
                          >
                            <Pencil size={16} />
                          </Link>
                        )}
                        {(role === "ACCOUNTANT" || role === "ADMIN") && (
                          <button
                            onClick={() => handlePaymentClick(row)}
                            className="text-green-600 hover:text-green-800 cursor-pointer"
                            title="Process Payment"
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-gray-100 font-bold">
                  <td colSpan="5" className="p-3 text-right">
                    Total:
                  </td>
                  <td className="p-3">₹{totalAmount.toFixed(2)}</td>
                  <td className="p-3">₹{approvedAmount.toFixed(2)}</td>
                  <td colSpan="3" className="p-3"></td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan="10" className="p-4 text-center text-gray-500">
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {sortedRows.length > 0 ? (
          <>
            {sortedRows.map((row) => {
              const totalCost =
                Number(row.TicketCost || 0) +
                Number(row.HotelCost || 0) +
                Number(row.MealsCost || 0) +
                Number(row.OtherExpenses || 0);

              return (
                <div
                  key={row.ID}
                  className="bg-white p-4 rounded-lg shadow-md border border-gray-200"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-bold text-gray-800">
                      Expense #{row.ID}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        row.approval_status === "Approved"
                          ? "bg-green-100 text-green-800"
                          : row.approval_status === "Pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {row.approval_status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div className="col-span-2">
                      <span className="font-semibold">User:</span>{" "}
                      {row.username}
                    </div>
                    <div>
                      <span className="font-semibold">Date:</span>{" "}
                      {row.TravelDate
                        ? dayjs(row.TravelDate).format("DD MMM YYYY")
                        : "-"}
                    </div>
                    <div>
                      <span className="font-semibold">Payment Date:</span>{" "}
                      {row.payment_date && row.payment_date !== "0000-00-00"
                        ? dayjs(row.payment_date).format("DD MMM YYYY")
                        : "-"}
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold">Travel:</span>{" "}
                      {row.FromLocation} to {row.Tolocation}
                    </div>
                    <div>
                      <span className="font-semibold">Total:</span> ₹
                      {totalCost.toFixed(2)}
                    </div>
                    <div>
                      <span className="font-semibold">Approved:</span>{" "}
                      {row.approval_status === "Rejected" ||
                      !(Number(row.approved_amount) > 0)
                        ? "-"
                        : `₹${Number(row.approved_amount).toFixed(2)}`}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between items-center border-t pt-3">
                    <Link
                      href={`/user-dashboard/expenses/${row.ID}`}
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-semibold"
                    >
                      View Details <ExternalLink size={14} />
                    </Link>
                    {row.approval_status !== "Approved" && row.approval_status !== "Rejected" && (
                      <Link
                        href={`/user-dashboard/expenses/edit/${row.ID}`}
                        className="text-yellow-600 hover:text-yellow-800 flex items-center gap-1 text-sm font-semibold"
                      >
                        Edit <Pencil size={14} />
                      </Link>
                    )}
                    {(role === "ACCOUNTANT" || role === "ADMIN") && (
                      <button
                        onClick={() => handlePaymentClick(row)}
                        className="text-green-600 hover:text-green-800 flex items-center gap-1 text-sm font-semibold"
                      >
                        Process Payment <CreditCard size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Mobile Total Card */}
            <div className="bg-blue-600 text-white p-4 rounded-lg shadow-md border-2 border-blue-700">
              <h3 className="text-lg font-bold mb-2">Summary</h3>
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold">Total Amount:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold">Approved Amount:</span>
                <span>₹{approvedAmount.toFixed(2)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 p-4 bg-white rounded-lg shadow-md">
            No entries found.
          </div>
        )}
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
