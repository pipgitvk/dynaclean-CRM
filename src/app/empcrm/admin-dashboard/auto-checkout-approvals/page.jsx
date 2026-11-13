"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AttendanceAutoCheckoutApprovalsCard from "@/components/AttendanceAutoCheckoutApprovalsCard";
import { ArrowLeft } from "lucide-react";

export default function AutoCheckoutApprovalsPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [employees, setEmployees] = useState([]);
  const [queueCount, setQueueCount] = useState(null);

  const [activeFrom, setActiveFrom] = useState("");
  const [activeTo, setActiveTo] = useState("");
  const [activeEmployee, setActiveEmployee] = useState("");
  const [activeStatus, setActiveStatus] = useState("pending");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/empcrm/employees");
        const data = await res.json();
        if (data?.success) setEmployees(data.employees || []);
      } catch (e) {
        console.error("auto-checkout-approvals employees:", e);
      }
    })();
  }, []);

  const employeeOptions = useMemo(() => {
    const placeholder = { value: "", label: "All employees" };
    const seen = new Set();
    const opts = employees
      .filter((emp) => emp?.username)
      .map((emp) => {
        if (seen.has(emp.username)) return null;
        seen.add(emp.username);
        return {
          value: emp.username,
          label: `${emp.full_name ? `${emp.full_name} — ` : ""}${emp.username}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
    return [placeholder, ...opts];
  }, [employees]);

  const applyFilters = () => {
    setActiveFrom(fromDate);
    setActiveTo(toDate);
    setActiveEmployee(employeeFilter);
    setActiveStatus(statusFilter);
    setRefreshKey((n) => n + 1);
  };

  const setStatusAndApply = (next) => {
    setStatusFilter(next);
    setActiveStatus(next);
    setRefreshKey((n) => n + 1);
  };

  return (
    <div className="w-full py-2 sm:py-4 px-2 sm:px-0">
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/empcrm/admin-dashboard"
              className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Automatic check-out approval
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              SUPERADMIN approves system check-outs (default 9:00 PM). Until
              approved, the employee&apos;s{" "}
              <span className="font-semibold">Present</span> counts as{" "}
              <span className="font-semibold">half-day</span> and{" "}
              <span className="font-semibold">Half-Days</span> +1. After approve,
              full present applies.
            </p>
          </div>
          <Link
            href="/empcrm/admin-dashboard/attendance"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0"
          >
            Open attendance details →
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            From <span className="text-xs font-normal text-gray-500">(optional)</span>
            <TypeableDateFilterInput
              value={fromDate}
              onChange={setFromDate}
              className="min-w-[160px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            To <span className="text-xs font-normal text-gray-500">(optional)</span>
            <TypeableDateFilterInput
              value={toDate}
              onChange={setToDate}
              min={fromDate || undefined}
              className="min-w-[160px]"
            />
          </label>
          <div className="flex min-w-[200px] flex-col gap-1 text-sm font-medium text-gray-700">
            Employee
            <SearchableSelect
              options={employeeOptions}
              value={employeeFilter}
              onChange={setEmployeeFilter}
              placeholder="All employees"
              searchPlaceholder="Search employee…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            {[
              { id: "pending", label: "Pending" },
              { id: "rejected", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusAndApply(tab.id)}
                className={`rounded-md px-3 py-2 font-medium transition-colors ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
                {tab.id === "pending" &&
                queueCount != null &&
                activeStatus === "pending" ? (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-white/25 px-1.5 text-xs">
                    {queueCount}
                  </span>
                ) : null}
              </button>
            ))}
            </div>
          </div>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Apply filters
          </button>
        </div>

        <AttendanceAutoCheckoutApprovalsCard
          key={`${refreshKey}-${activeStatus}`}
          fromDate={activeFrom || undefined}
          toDate={activeTo || undefined}
          username={activeEmployee || undefined}
          statusFilter={activeStatus}
          onQueueCountChange={setQueueCount}
        />
      </div>
    </div>
  );
}
