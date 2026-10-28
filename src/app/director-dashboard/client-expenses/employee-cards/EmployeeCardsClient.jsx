"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { Search, IndianRupee, ArrowLeft, ChevronUp, ChevronDown, X, Inbox, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function EmployeeCardsClient({ employees }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (emp) =>
        (emp.username || "").toLowerCase().includes(q) ||
        (emp.name || "").toLowerCase().includes(q) ||
        (emp.userRole || "").toLowerCase().includes(q)
    );
  }, [employees, searchTerm]);

  const sortedEmployees = useMemo(() => {
    if (!sortConfig.key) return filteredEmployees;
    
    return [...filteredEmployees].sort((a, b) => {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      const key = sortConfig.key;

      const getVal = (emp) => {
        switch (key) {
          case "username":
            return (emp.username || "").toLowerCase();
          case "name":
            return (emp.name || "").toLowerCase();
          case "total":
            return emp.stats?.total || 0;
          case "paid":
            return emp.stats?.paid || 0;
          case "pendingApproval":
            return emp.stats?.pendingApproval || 0;
          case "toPay":
            return emp.stats?.toPay || 0;
          default:
            return 0;
        }
      };

      const va = getVal(a);
      const vb = getVal(b);
      
      if (typeof va === "string") {
        return va.localeCompare(vb) * dir;
      }
      return (va - vb) * dir;
    });
  }, [filteredEmployees, sortConfig]);

  // Calculate overall summary statistics
  const overallStats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pendingApproval = 0;
    let toPay = 0;

    employees.forEach(emp => {
      if (emp.stats) {
        total += emp.stats.total || 0;
        paid += emp.stats.paid || 0;
        pendingApproval += emp.stats.pendingApproval || 0;
        toPay += emp.stats.toPay || 0;
      }
    });

    return { total, paid, pendingApproval, toPay };
  }, [employees]);

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const handleReset = () => {
    setSearchTerm("");
    setSortConfig({ key: null, direction: "asc" });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === "asc" 
      ? <ChevronUp className="inline w-4 h-4 ml-0.5" /> 
      : <ChevronDown className="inline w-4 h-4 ml-0.5" />;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/director-dashboard/client-expenses/cards"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-700">Active Employees</h1>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              autoComplete="off"
            />
          </div>
          <button
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors w-full sm:w-auto shrink-0"
          >
            <X size={14} />
            Reset
          </button>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₹{overallStats.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-600">Paid</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            ₹{overallStats.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-600">Pending Approval</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            ₹{overallStats.pendingApproval.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-600">To Pay (Approved)</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            ₹{overallStats.toPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-auto bg-white shadow-lg rounded-xl border border-gray-200">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gradient-to-r from-slate-700 to-slate-800 sticky top-0 z-10">
            <tr className="text-left font-medium text-white">
              <th onClick={() => handleSort("username")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors rounded-tl-xl">
                Username<SortIcon column="username" />
              </th>
              <th onClick={() => handleSort("name")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">
                Name<SortIcon column="name" />
              </th>
              <th className="p-3">Role</th>
              <th onClick={() => handleSort("total")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">
                Total<SortIcon column="total" />
              </th>
              <th onClick={() => handleSort("paid")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">
                Paid<SortIcon column="paid" />
              </th>
              <th onClick={() => handleSort("pendingApproval")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors">
                Pending Approval<SortIcon column="pendingApproval" />
              </th>
              <th onClick={() => handleSort("toPay")} className="p-3 cursor-pointer select-none hover:bg-slate-600/50 transition-colors rounded-tr-xl">
                To Pay<SortIcon column="toPay" />
              </th>
            </tr>
          </thead>
          <tbody className="text-gray-800 bg-white">
            {sortedEmployees.length > 0 ? (
              sortedEmployees.map((emp) => (
                <tr
                  key={emp.username}
                  className="hover:bg-blue-50/50 transition-colors duration-150 border-b border-gray-100 last:border-0 cursor-pointer"
                  onClick={() => router.push(`/director-dashboard/all-expenses?username=${encodeURIComponent(emp.username)}`)}
                >
                  <td className="p-3 font-medium text-gray-700">{emp.username}</td>
                  <td className="p-3 text-gray-700">{emp.name || "-"}</td>
                  <td className="p-3 text-gray-600">{emp.userRole || "Employee"}</td>
                  <td className="p-3 font-semibold text-gray-900 tabular-nums">
                    ₹{emp.stats?.total.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || "0.00"}
                  </td>
                  <td className="p-3 font-semibold text-green-600 tabular-nums">
                    ₹{emp.stats?.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || "0.00"}
                  </td>
                  <td className="p-3 font-semibold text-yellow-600 tabular-nums">
                    ₹{emp.stats?.pendingApproval.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || "0.00"}
                  </td>
                  <td className="p-3 font-semibold text-purple-600 tabular-nums">
                    ₹{emp.stats?.toPay.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || "0.00"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="p-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="w-12 h-12 text-gray-300" />
                    <span className="font-medium">No employees found.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden flex flex-col gap-4">
        {sortedEmployees.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-500">
            <Inbox className="w-12 h-12 text-gray-300" />
            <span className="font-medium">No employees found.</span>
          </div>
        )}
        {sortedEmployees.map((emp) => (
          <button
            key={emp.username}
            onClick={() => router.push(`/director-dashboard/all-expenses?username=${encodeURIComponent(emp.username)}`)}
            className="border border-gray-200 rounded-xl p-4 shadow-md bg-white text-sm space-y-3 hover:shadow-lg hover:border-blue-300 transition-all text-left"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Employee</span>
                <div className="font-semibold text-gray-800 mt-0.5">{emp.name || emp.username}</div>
                <div className="text-xs text-gray-500 mt-1">{emp.userRole}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-gray-600 pt-2 border-t border-gray-100">
              <div>
                <span className="text-gray-500 text-xs block">Total</span>
                <span className="font-semibold text-gray-900 text-sm">₹{emp.stats?.total.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || "0.00"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Paid</span>
                <span className="font-semibold text-green-600 text-sm">₹{emp.stats?.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || "0.00"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Pending</span>
                <span className="font-semibold text-yellow-600 text-sm">₹{emp.stats?.pendingApproval.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || "0.00"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">To Pay</span>
                <span className="font-semibold text-purple-600 text-sm">₹{emp.stats?.toPay.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || "0.00"}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
