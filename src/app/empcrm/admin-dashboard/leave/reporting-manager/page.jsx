"use client";

import { useEffect, useMemo, useState } from "react";
import { User, X } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import Link from "next/link";

function hashStringToInt(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0; // keep as uint32
  }
  return h;
}

function getBadgeColorClass(username) {
  const colors = [
    "bg-blue-50 text-blue-800 border-blue-200",
    "bg-emerald-50 text-emerald-800 border-emerald-200",
    "bg-indigo-50 text-indigo-800 border-indigo-200",
    "bg-purple-50 text-purple-800 border-purple-200",
    "bg-pink-50 text-pink-800 border-pink-200",
    "bg-amber-50 text-amber-800 border-amber-200",
    "bg-sky-50 text-sky-800 border-sky-200",
    "bg-teal-50 text-teal-800 border-teal-200",
    "bg-rose-50 text-rose-800 border-rose-200",
  ];

  const idx = hashStringToInt(username || "unknown") % colors.length;
  return colors[idx];
}

export default function ReportingManagerSelectorPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [canAdd, setCanAdd] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedReportingManager, setSelectedReportingManager] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();
        const role = data?.userRole || data?.role || "";
        setCanAdd(["HR", "HR HEAD", "HR Executive"].includes(role));
      } catch {
        setCanAdd(false);
      } finally {
        setRoleLoading(false);
      }
    };

    fetchRole();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/empcrm/employees");
      const data = await res.json();
      if (data?.success) setEmployees(data.employees || []);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const managerOptions = useMemo(() => {
    if (!selectedEmployee) return [];
    const seen = new Set();
    const opts = employees
      .filter((emp) => emp?.username && emp.username !== selectedEmployee.username)
      .map((emp) => {
        const username = emp.username;
        if (seen.has(username)) return null;
        seen.add(username);
        return {
          value: username,
          label: `${username}${emp.userRole ? ` (${emp.userRole})` : ""}`,
        };
      })
      .filter(Boolean);
    return [{ value: "", label: "-- Select Reporting Manager --" }, ...opts];
  }, [employees, selectedEmployee]);

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const q = searchTerm.toLowerCase().trim();
    return employees.filter((emp) => {
      const fullName = emp.full_name || "";
      const username = emp.username || "";
      const empId = emp.empId ? String(emp.empId) : "";
      const userRole = emp.userRole || "";
      const reportingManager = emp.reporting_manager || "";
      return (
        fullName.toLowerCase().includes(q) ||
        username.toLowerCase().includes(q) ||
        empId.includes(q) ||
        userRole.toLowerCase().includes(q) ||
        reportingManager.toLowerCase().includes(q)
      );
    });
  }, [employees, searchTerm]);

  const openModalForEmployee = (emp) => {
    setSelectedEmployee(emp);
    setSelectedReportingManager("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmployee(null);
    setSelectedReportingManager("");
    setSaving(false);
  };

  const saveReportingManager = async () => {
    if (!selectedEmployee?.username) return;
    if (!selectedReportingManager) {
      alert("Please select a reporting manager");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/employees/set-reporting-manager", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeUsername: selectedEmployee.username,
          reportingManagerUsername: selectedReportingManager || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        alert(data?.error || data?.message || "Failed to update reporting manager");
        return;
      }

      // Close and let HR re-check in leave approvals
      closeModal();
      await fetchEmployees();
    } catch {
      alert("Error updating reporting manager");
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading) {
    return <div className="p-6 max-w-3xl mx-auto text-center text-gray-500">Loading...</div>;
  }

  if (!canAdd) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">Unauthorized</p>
          <Link href="/empcrm/admin-dashboard/leave" className="mt-4 inline-flex text-blue-600 hover:text-blue-800">
            Back to Leave Management
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Set Reporting Manager</h1>
          <p className="text-gray-600 mt-1">Choose an employee to assign a reporting manager.</p>
        </div>
        <Link
          href="/empcrm/admin-dashboard/leave"
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No employees found</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, username, or empId..."
              className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
            <button
              type="button"
              key={emp.username}
              onClick={() => openModalForEmployee(emp)}
              className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {emp.full_name || emp.username}
                  </div>
                  <div className="text-sm text-gray-500">
                    EmpID: {emp.empId}
                  </div>
                  {emp.userRole && (
                    <div className="text-xs text-gray-400 truncate">{emp.userRole}</div>
                  )}
                  {emp.reporting_manager && (
                    <div
                      className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium border ${getBadgeColorClass(
                        emp.reporting_manager
                      )} truncate`}
                      title={emp.reporting_manager}
                    >
                      <span className="inline-block w-2 h-2 rounded-full bg-current opacity-70" />
                      Reporting Manager: {emp.reporting_manager}
                    </div>
                  )}
                </div>
              </div>
            </button>
            ))}
          </div>
        </>
      )}

      {/* Reporting Manager Modal */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-visible">
            <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Set Reporting Manager</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Employee:{" "}
                  <span className="font-medium text-gray-900">
                    {selectedEmployee.full_name || selectedEmployee.username}
                  </span>
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reporting Manager
                </label>
                <SearchableSelect
                  options={managerOptions}
                  value={selectedReportingManager}
                  onChange={(val) => setSelectedReportingManager(val)}
                  placeholder="-- Select Reporting Manager --"
                  searchPlaceholder="Search manager..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveReportingManager}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

