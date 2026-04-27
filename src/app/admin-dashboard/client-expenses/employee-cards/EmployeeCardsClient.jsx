"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { User, ChevronRight, Search, IndianRupee, ArrowLeft } from "lucide-react";

export default function EmployeeCardsClient({ employees }) {
  const [searchTerm, setSearchTerm] = useState("");

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

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin-dashboard/client-expenses/cards"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-700">Active Employees</h1>
        </div>

        <div className="relative w-full max-w-md">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredEmployees.map((emp) => (
          <Link
                    key={emp.username}
                    href={`/admin-dashboard/all-expenses?username=${encodeURIComponent(emp.username)}`}
                    className="group relative flex flex-col bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                  >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <User className="w-6 h-6" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {emp.name || emp.username}
              </h3>
              <p className="text-sm text-gray-500 font-medium">{emp.userRole || "Employee"}</p>
              <p className="text-xs text-gray-400 truncate">{emp.email || "No email"}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Username</span>
              <span className="text-sm font-semibold text-gray-700">{emp.username}</span>
            </div>
          </Link>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No employees found matching your search.</p>
        </div>
      )}
    </div>
  );
}
