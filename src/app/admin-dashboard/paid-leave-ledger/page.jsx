"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  Plus, 
  Minus,
  Download,
  Info,
  AlertCircle,
  Clock,
  XCircle,
  CheckCircle2,
  FileText
} from "lucide-react";

export default function PaidLeaveLedger() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [ledgerData, setLedgerData] = useState([]);
  const [unpaidLedgerData, setUnpaidLedgerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalCredit: 0,
    totalDebit: 0,
    balance: 0
  });
  const [unpaidSummary, setUnpaidSummary] = useState({
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0,
    totalDays: 0
  });
  const [accrualStartDate, setAccrualStartDate] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/empcrm/employees");
      const data = await res.json();
      if (data?.success) {
        setEmployees(data.employees || []);
      }
    } catch (e) {
      console.error("Error fetching employees:", e);
    }
  };

  const fetchLedger = async (username) => {
    if (!username) {
      setLedgerData([]);
      setUnpaidLedgerData([]);
      setSummary({ totalCredit: 0, totalDebit: 0, balance: 0 });
      setUnpaidSummary({ totalApproved: 0, totalPending: 0, totalRejected: 0, totalDays: 0 });
      setAccrualStartDate(null);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/empcrm/leaves/paid-leave-ledger?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      
      if (data?.success) {
        setLedgerData(data.ledger || []);
        setUnpaidLedgerData(data.unpaidLedger || []);
        setSummary(data.summary || { totalCredit: 0, totalDebit: 0, balance: 0 });
        setUnpaidSummary(data.unpaidSummary || { totalApproved: 0, totalPending: 0, totalRejected: 0, totalDays: 0 });
        setAccrualStartDate(data.accrualStartDate);
      }
    } catch (e) {
      console.error("Error fetching ledger:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (username) => {
    setSelectedEmployee(username);
    fetchLedger(username);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const downloadLedger = () => {
    if (ledgerData.length === 0 && unpaidLedgerData.length === 0) {
      alert("No data to download");
      return;
    }

    const selectedEmp = employees.find(e => e.username === selectedEmployee);
    
    let csv = `Leave Ledger (Paid + Unpaid) - ${selectedEmp?.full_name || selectedEmployee}\n`;
    csv += `Generated on: ${new Date().toLocaleDateString('en-IN')}\n\n`;

    csv += `=== PAID LEAVE SUMMARY ===\n`;
    csv += `Total Added (Credit),${summary.totalCredit}\n`;
    csv += `Total Used (Debit),${summary.totalDebit}\n`;
    csv += `Balance,${summary.balance}\n\n`;

    csv += `=== PAID LEAVE LEDGER ===\n`;
    const paidHeaders = ["Date", "Type", "Days", "Description", "Running Balance"];
    const paidRows = ledgerData.map(entry => [
      formatDate(entry.date),
      entry.type === "credit" ? "CREDIT" : "DEBIT",
      entry.days,
      entry.description || "",
      entry.runningBalance || ""
    ]);
    csv += paidHeaders.join(",") + "\n";
    csv += paidRows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n") + "\n\n";

    csv += `=== UNPAID LEAVE SUMMARY ===\n`;
    csv += `Total Approved,${unpaidSummary.totalApproved}\n`;
    csv += `Total Pending,${unpaidSummary.totalPending}\n`;
    csv += `Total Rejected,${unpaidSummary.totalRejected}\n`;
    csv += `Total All Unpaid Days,${unpaidSummary.totalDays}\n\n`;

    csv += `=== UNPAID LEAVE LEDGER ===\n`;
    const unpaidHeaders = ["Date", "Status", "Days", "Description", "Reason"];
    const unpaidRows = unpaidLedgerData.map(entry => [
      formatDate(entry.date),
      entry.status?.toUpperCase() || "",
      entry.days,
      entry.description || "",
      entry.reason?.substring(0, 100) || ""
    ]);
    csv += unpaidHeaders.join(",") + "\n";
    csv += unpaidRows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-ledger-${selectedEmployee}.csv`;
    a.click();
  };

  const selectedEmp = employees.find(e => e.username === selectedEmployee);

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1" /> APPROVED
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" /> PENDING
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" /> REJECTED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          Leave Ledger
        </h1>
        <p className="text-gray-600 mt-2">
          Track paid leave accruals, usage, and unpaid leaves by date. Shows complete leave history for employees.
        </p>
      </div>

      {/* Employee Selector */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Employee
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => handleEmployeeSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose an employee...</option>
              {employees.map(emp => (
                <option key={emp.empId} value={emp.username}>
                  {emp.username} - {emp.full_name || ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={downloadLedger}
              disabled={!selectedEmployee || loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {selectedEmployee && (
        <>
          {/* Overview: Quick Summary Cards - Both Paid + Unpaid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Plus className="w-4 h-4 text-green-500" />
                <p className="text-xs text-green-600 font-medium">Paid Added</p>
              </div>
              <p className="text-2xl font-bold text-green-800">{summary.totalCredit}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Minus className="w-4 h-4 text-red-500" />
                <p className="text-xs text-red-600 font-medium">Paid Used</p>
              </div>
              <p className="text-2xl font-bold text-red-800">{summary.totalDebit}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-blue-600 font-medium">Paid Balance</p>
              </div>
              <p className={`text-2xl font-bold ${summary.balance >= 0 ? "text-blue-800" : "text-red-800"}`}>
                {summary.balance}
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <p className="text-xs text-orange-600 font-medium">Unpaid Total</p>
              </div>
              <p className="text-2xl font-bold text-orange-800">{unpaidSummary.totalDays}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-xs text-emerald-600 font-medium">Unpaid Approve</p>
              </div>
              <p className="text-2xl font-bold text-emerald-800">{unpaidSummary.totalApproved}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <p className="text-xs text-amber-600 font-medium">Unpaid Pending</p>
              </div>
              <p className="text-2xl font-bold text-amber-800">{unpaidSummary.totalPending}</p>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-rose-500" />
                <p className="text-xs text-rose-600 font-medium">Unpaid Rejected</p>
              </div>
              <p className="text-2xl font-bold text-rose-800">{unpaidSummary.totalRejected}</p>
            </div>
          </div>

          {/* PAID LEAVE SECTION */}
          <div className="mb-6 bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Paid Leave</h2>
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {summary.balance} Days Remaining
              </span>
            </div>

            {/* Monthly Breakdown for Total Added */}
            {ledgerData.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Accruals by Month</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {(() => {
                    const monthlyBreakdown = {};
                    ledgerData
                      .filter(entry => entry.type === "credit")
                      .forEach(entry => {
                        const date = new Date(entry.date);
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        const monthName = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                        
                        if (!monthlyBreakdown[monthKey]) {
                          monthlyBreakdown[monthKey] = { name: monthName, days: 0 };
                        }
                        monthlyBreakdown[monthKey].days += entry.days;
                      });

                    return Object.entries(monthlyBreakdown)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([key, data]) => (
                        <div key={key} className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-green-600 font-medium">{data.name}</p>
                          <p className="text-2xl font-bold text-green-800">{data.days}</p>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            )}

            {/* Paid Ledger Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading ledger...</div>
              ) : ledgerData.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No paid leave transactions found for {selectedEmp?.full_name || selectedEmployee}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description / Reason
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {ledgerData.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div>
                              <div className="font-medium">{formatDate(entry.date)}</div>
                              {entry.expiryDate && (
                                <div className="text-xs text-gray-500">Expires: {formatDate(entry.expiryDate)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {entry.type === "credit" ? (
                                <>
                                  <Plus className="w-4 h-4 text-green-600" />
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    CREDIT
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Minus className="w-4 h-4 text-red-600" />
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    DEBIT
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-semibold text-gray-900">
                            {entry.days}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div>
                              <div>{entry.description}</div>
                              {entry.reason && (
                                <div className="text-xs text-gray-500 mt-1">Reason: {entry.reason.substring(0, 100)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-gray-900">
                            <span className={entry.runningBalance < 0 ? "text-red-600" : "text-green-600"}>
                              {entry.runningBalance}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* UNPAID LEAVE SECTION */}
          <div className="mb-6 bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-800">Unpaid Leave</h2>
              <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                {unpaidSummary.totalDays} Total Days
              </span>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-medium">
                  A: {unpaidSummary.totalApproved}
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium">
                  P: {unpaidSummary.totalPending}
                </span>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-medium">
                  R: {unpaidSummary.totalRejected}
                </span>
              </div>
            </div>

            {/* Monthly Breakdown for Unpaid Leaves */}
            {unpaidLedgerData.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Unpaid by Month</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {(() => {
                    const monthlyBreakdown = {};
                    unpaidLedgerData.forEach(entry => {
                      const date = new Date(entry.date);
                      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const monthName = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                      
                      if (!monthlyBreakdown[monthKey]) {
                        monthlyBreakdown[monthKey] = { name: monthName, days: 0, approved: 0, pending: 0, rejected: 0 };
                      }
                      monthlyBreakdown[monthKey].days += entry.days;
                      if (entry.status === 'approved') monthlyBreakdown[monthKey].approved += entry.days;
                      if (entry.status === 'pending') monthlyBreakdown[monthKey].pending += entry.days;
                      if (entry.status === 'rejected') monthlyBreakdown[monthKey].rejected += entry.days;
                    });

                    return Object.entries(monthlyBreakdown)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([key, data]) => (
                        <div key={key} className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-orange-600 font-medium">{data.name}</p>
                          <p className="text-2xl font-bold text-orange-800">{data.days}</p>
                          <div className="text-xs mt-1 space-y-0.5">
                            {data.approved > 0 && <p className="text-emerald-600">A: {data.approved}</p>}
                            {data.pending > 0 && <p className="text-amber-600">P: {data.pending}</p>}
                            {data.rejected > 0 && <p className="text-red-600">R: {data.rejected}</p>}
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            )}

            {/* Unpaid Ledger Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading ledger...</div>
              ) : unpaidLedgerData.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No unpaid leave records found for {selectedEmp?.full_name || selectedEmployee}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-orange-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Range
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rejection Note
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {unpaidLedgerData.map((entry, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50 ${
                          entry.status === 'rejected' ? 'bg-red-50/30' : 
                          entry.status === 'pending' ? 'bg-amber-50/30' : ''
                        }`}>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div>
                              <div className="font-medium">{formatDate(entry.date)}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                To: {formatDate(entry.to_date || entry.date)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(entry.status)}
                          </td>
                          <td className="px-6 py-4 text-center font-semibold text-gray-900">
                            <span className={entry.status === 'approved' ? 'text-emerald-600' : 
                                            entry.status === 'pending' ? 'text-amber-600' : 'text-red-600'}>
                              {entry.days}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                            <div className="line-clamp-2">
                              {entry.reason || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-red-600 max-w-xs">
                            {entry.rejection_reason ? (
                              <div className="line-clamp-2">
                                {entry.rejection_reason}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedEmployee && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Calendar className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <p className="text-blue-800 font-medium">Select an employee to view their complete leave ledger (Paid + Unpaid)</p>
        </div>
      )}
    </div>
  );
}
