"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  Plus, 
  Minus,
  Download,
  Info
} from "lucide-react";

export default function PaidLeaveLedger() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalCredit: 0,
    totalDebit: 0,
    balance: 0
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
      setSummary({ totalCredit: 0, totalDebit: 0, balance: 0 });
      setAccrualStartDate(null);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/empcrm/leaves/paid-leave-ledger?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      
      if (data?.success) {
        setLedgerData(data.ledger || []);
        setSummary(data.summary || { totalCredit: 0, totalDebit: 0, balance: 0 });
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
    if (ledgerData.length === 0) {
      alert("No data to download");
      return;
    }

    const selectedEmp = employees.find(e => e.username === selectedEmployee);
    const headers = ["Date", "Type", "Days", "Description"];
    const rows = ledgerData.map(entry => [
      formatDate(entry.date),
      entry.type === "credit" ? "CREDIT" : "DEBIT",
      entry.days,
      entry.description || ""
    ]);

    let csv = `Paid Leave Ledger - ${selectedEmp?.full_name || selectedEmployee}\n`;
    csv += `Generated on: ${new Date().toLocaleDateString('en-IN')}\n\n`;
    csv += headers.join(",") + "\n";
    csv += rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    csv += `\n\nTotal Credit,${summary.totalCredit}\n`;
    csv += `Total Debit,${summary.totalDebit}\n`;
    csv += `Balance,${summary.balance}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paid-leave-ledger-${selectedEmployee}.csv`;
    a.click();
  };

  const selectedEmp = employees.find(e => e.username === selectedEmployee);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          Paid Leave Ledger
        </h1>
        <p className="text-gray-600 mt-2">
          Track paid leave accruals and usage by date. Shows when leaves were added and when employees took them.
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
          {/* Monthly Breakdown for Total Added */}
          {ledgerData.length > 0 && (
            <div className="mb-6 bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Paid Leaves Added by Month</h3>
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Total Added</p>
                  <p className="text-3xl font-bold text-green-800">{summary.totalCredit}</p>
                  <p className="text-xs text-green-600 mt-1">Paid leaves accrued</p>
                </div>
                <Plus className="w-10 h-10 text-green-400" />
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Total Used</p>
                  <p className="text-3xl font-bold text-red-800">{summary.totalDebit}</p>
                  <p className="text-xs text-red-600 mt-1">Paid leaves taken</p>
                </div>
                <Minus className="w-10 h-10 text-red-400" />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Balance</p>
                  <p className={`text-3xl font-bold ${summary.balance >= 0 ? "text-blue-800" : "text-red-800"}`}>
                    {summary.balance}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">Available leaves</p>
                </div>
                <Calendar className="w-10 h-10 text-blue-400" />
              </div>
            </div>
          </div>





          {/* Ledger Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
                        Description / Accrual Info
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
        </>
      )}

      {!selectedEmployee && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Calendar className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <p className="text-blue-800 font-medium">Select an employee to view their paid leave ledger</p>
        </div>
      )}
    </div>
  );
}
