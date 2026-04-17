// app/EmpTable.jsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Link from "next/link";
import { LogIn, Key, Edit, Shield, UserPlus, X } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";
import toast from "react-hot-toast";
import {
  getModuleTreeForEmployeeBulkUi,
  ALL_MODULE_KEYS,
  collectModuleKeysFromUiNode,
  buildModuleUiSearchIndex,
} from "@/lib/moduleAccess";

function uniqueStrings(arr) {
  return [...new Set((arr || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

/** Global Module Access: mirrors super-admin sidebar (single row vs nested groups). */
function ModuleUiBlock({
  node,
  selected,
  disabled,
  onToggleGroup,
  onToggleChild,
  depth = 0,
}) {
  const [open, setOpen] = useState(true);
  const parentRef = useRef(null);
  const isGroup = node.kind === "group";
  const keys = isGroup ? collectModuleKeysFromUiNode(node) : [];
  const checkedCount = isGroup ? keys.filter((k) => selected.includes(k)).length : 0;
  const total = isGroup ? keys.length : 0;
  const allChecked = isGroup && total > 0 && checkedCount === total;
  const someChecked = isGroup && checkedCount > 0 && checkedCount < total;
  const noneChecked = isGroup && checkedCount === 0;

  useEffect(() => {
    if (parentRef.current && isGroup) {
      parentRef.current.indeterminate = someChecked;
    }
  }, [isGroup, someChecked]);

  if (node.kind === "single") {
    const isChecked = selected.includes(node.key);
    return (
      <div
        id={`bulk-section-${node.id}`}
        className={`border rounded-lg overflow-hidden transition-all ${
          isChecked
            ? "border-blue-300 bg-blue-50/40"
            : "border-gray-200 bg-white"
        }`}
      >
        <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => !disabled && onToggleChild(node.key)}
            disabled={disabled}
            className="w-4 h-4 accent-blue-600 flex-shrink-0"
          />
          <span className="text-sm font-semibold text-gray-800">{node.label}</span>
        </label>
      </div>
    );
  }

  if (!isGroup || !node.children?.length) return null;

  const shellClass =
    depth === 0
      ? allChecked
        ? "border-blue-300 bg-blue-50/40"
        : noneChecked
          ? "border-gray-200 bg-white"
          : "border-amber-200 bg-amber-50/30"
      : "border-gray-200 bg-gray-50/50";

  return (
    <div
      id={`bulk-section-${node.id}`}
      className={`border rounded-lg overflow-hidden transition-all ${shellClass}`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            ref={parentRef}
            type="checkbox"
            checked={allChecked}
            onChange={() => !disabled && onToggleGroup(node)}
            disabled={disabled}
            className="w-4 h-4 accent-blue-600 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <span
            className={`text-sm font-semibold truncate ${depth > 0 ? "text-gray-700" : ""}`}
          >
            {node.label}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">
            ({checkedCount}/{total})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-xs px-1"
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "▲" : "▼"}
        </button>
      </div>

      {open && (
        <div
          className={`border-t border-gray-100 px-3 pb-3 pt-2 ${
            depth > 0 ? "ml-1 border-l-2 border-gray-200 pl-3" : ""
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {node.children.map((ch) =>
              ch.kind === "group" ? (
                <div key={ch.id} className="col-span-full">
                  <ModuleUiBlock
                    node={ch}
                    selected={selected}
                    disabled={disabled}
                    onToggleGroup={onToggleGroup}
                    onToggleChild={onToggleChild}
                    depth={depth + 1}
                  />
                </div>
              ) : (
                <label
                  key={ch.key}
                  id={`bulk-module-${ch.key}`}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors text-xs ${
                    selected.includes(ch.key)
                      ? "bg-blue-50 border-blue-200 text-blue-800"
                      : "bg-white border-gray-100 text-gray-500 hover:border-blue-200"
                  } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(ch.key)}
                    onChange={() => !disabled && onToggleChild(ch.key)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                  />
                  <span className="leading-tight">{ch.label}</span>
                </label>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const EmployeeCard = ({
  employee,
  handleImpersonateLogin,
  handleOpenReportingManagerModal,
  maskEmail,
  maskNumber,
  maskStatus,
}) => (
  <div className="bg-white shadow-md rounded-lg p-4 mb-4 border border-gray-200">
    <div className="mb-2">
      <span className="font-semibold text-gray-700">Name:</span>
      <p className="text-gray-900">{employee.username}</p>
    </div>

    <div className="mb-2">
      <span className="font-semibold text-gray-700">Email:</span>
      <p className="text-gray-600">{maskEmail(employee.email)}</p>
    </div>

    <div className="mb-2">
      <span className="font-semibold text-gray-700">Number:</span>
      <p className="text-gray-600">{maskNumber(employee.number)}</p>
    </div>

    <div className="mb-2">
      <span className="font-semibold text-gray-700">Emp ID:</span>
      <p className="text-gray-600">{employee.empId}</p>
    </div>

    <div className="mb-2">
      <span className="font-semibold text-gray-700">User Role:</span>
      <p className="text-gray-600">{employee.userRole}</p>
    </div>

    <div className="mb-4">
      <span className="font-semibold text-gray-700">Reporting Manager:</span>
      <p className="text-gray-600">{employee.reporting_manager || "-"}</p>
    </div>

    <div className="mb-4">
      <span className="font-semibold text-gray-700">Status:</span>
      <p className="text-gray-600">{maskStatus(employee.status)}</p>
    </div>

    <div className="flex flex-wrap gap-2 sm:gap-3 justify-between items-center pt-2 border-t border-gray-100">
      <button
        onClick={() => handleImpersonateLogin(employee.empId)}
        className="text-blue-600 hover:text-blue-900 font-medium flex items-center space-x-1 text-sm"
      >
        <LogIn size={16} />
        <span>Login</span>
      </button>

      <Link
        href={`/admin-dashboard/password/${employee.username}`}
        className="text-yellow-600 hover:text-yellow-900 font-medium flex items-center space-x-1 text-sm"
      >
        <Key size={16} />
        <span>Password</span>
      </Link>

      <Link
        href={`/admin-dashboard/quick-edit/${employee.username}`}
        className="text-green-600 hover:text-green-900 font-medium flex items-center space-x-1 text-sm"
      >
        <Edit size={16} />
        <span>Edit</span>
      </Link>

      <Link
        href={`/admin-dashboard/ip-restrictions/${employee.username}`}
        className="text-purple-600 hover:text-purple-900 font-medium flex items-center space-x-1 text-sm"
      >
        <Shield size={16} />
        <span>IP</span>
      </Link>

      <button
        onClick={() => handleOpenReportingManagerModal(employee)}
        className="text-indigo-600 hover:text-indigo-900 font-medium flex items-center space-x-1 text-sm"
        title="Add Reporting Manager"
      >
        <UserPlus size={16} />
        <span>Manager</span>
      </button>

    </div>
  </div>
);

const EmpTable = ({ employees }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [isMobile, setIsMobile] = useState(false);
  const [showReportingManagerModal, setShowReportingManagerModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedReportingManager, setSelectedReportingManager] = useState("");
  const [savingReportingManager, setSavingReportingManager] = useState(false);
  const [employeeList, setEmployeeList] = useState([]);
  const [showGlobalModulesModal, setShowGlobalModulesModal] = useState(false);
  const [bulkRole, setBulkRole] = useState("ACCOUNTANT");
  const [bulkOperation, setBulkOperation] = useState("REPLACE");
  const [bulkSelectedModules, setBulkSelectedModules] = useState([]);
  const [bulkRoleSelections, setBulkRoleSelections] = useState({});
  const [bulkRoleLoading, setBulkRoleLoading] = useState(false);
  const [bulkTouched, setBulkTouched] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkModuleSearch, setBulkModuleSearch] = useState("");
  const router = useRouter();

  const persistBulkSelectionForRole = useCallback((role, modules) => {
    const key = String(role || "").trim();
    if (!key) return;
    setBulkRoleSelections((prev) => ({
      ...(prev || {}),
      [key]: Array.isArray(modules) ? modules : [],
    }));
  }, []);

  const fetchRoleModulesFromDB = useCallback(async (role) => {
    const key = String(role || "").trim();
    if (!key) return [];
    setBulkRoleLoading(true);
    try {
      const res = await fetch(
        `/api/admin/bulk-module-access?role=${encodeURIComponent(key)}&t=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const modules = Array.isArray(data?.moduleKeys) ? data.moduleKeys : [];
      setBulkRoleSelections((prev) => ({ ...(prev || {}), [key]: modules }));
      return modules;
    } catch {
      return [];
    } finally {
      setBulkRoleLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOpenReportingManagerModal = (employee) => {
    setSelectedEmployee(employee?.username || "");
    setSelectedReportingManager(employee?.reporting_manager || "");
    setEmployeeList(employees);
    setShowReportingManagerModal(true);
  };

  const handleSaveReportingManager = async () => {
    if (!selectedEmployee) {
      alert("Please select an employee.");
      return;
    }
    setSavingReportingManager(true);
    try {
      const res = await fetch("/api/employees/set-reporting-manager", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeUsername: selectedEmployee,
          reportingManagerUsername: selectedReportingManager || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowReportingManagerModal(false);
        router.refresh();
      } else {
        alert(data.error || "Failed to update reporting manager.");
      }
    } catch (err) {
      alert("Error updating reporting manager.");
    } finally {
      setSavingReportingManager(false);
    }
  };

  const handleImpersonateLogin = async (empId) => {
    console.log("Impersonate login for empId:", empId);
    try {
      const response = await fetch("/api/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empId }),
      });

      const data = await response.json();

      if (response.ok) {
        Cookies.set("impersonation_token", data.token, { expires: 1 / 24 });
        router.push("/user-dashboard");
      } else {
        console.log("error data :", data.error);
        // alert(data.error);
      }
    } catch (error) {
      alert("Error while impersonating.");
    }
  };

  // ⭐ KPI COUNTS
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status == 1).length;
  const inactiveEmployees = employees.filter((e) => e.status == 0).length;

  // ⭐ FILTER + SEARCH LOGIC
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = Object.values(employee).some((value) =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? employee.status == 1
          : employee.status == 0;

    return matchesSearch && matchesStatus;
  });

  const maskEmail = (email) => {
    if (!email) return "";
    const [username, domain] = email.split("@");
    const maskedUsername =
      username.slice(0, 1) + "*".repeat(username.length - 1);
    return `${maskedUsername}@${domain}`;
  };

  const maskNumber = (number) =>
    !number ? "" : "*".repeat(number.length - 4) + number.slice(-4);

  const maskStatus = (status) => (status == 1 ? "Active" : "Inactive");

  const allRoles = [
    "ACCOUNTANT",
    "TEAM LEADER",
    "SALES",
    "SALES HEAD",
    "DIGITAL MARKETER",
    "ADMIN",
    "HR",
    "HR HEAD",
    "HR EXECUTIVE",
    "GRAPHIC DESIGNER",
    "DESIGN ENGINEER",
    "SERVICE ENGINEER",
    "SERVICE TECHNICIAN",
    "SERVICE HEAD",
    "WELDER",
    "WELDER HELPER",
    "WAREHOUSE INCHARGE",
  ];

  const bulkModuleTree = useMemo(() => getModuleTreeForEmployeeBulkUi(), []);

  const bulkModuleIndex = useMemo(
    () => buildModuleUiSearchIndex(bulkModuleTree || []),
    [bulkModuleTree],
  );

  const bulkModuleSuggestions = useMemo(() => {
    const q = String(bulkModuleSearch || "").trim().toLowerCase();
    if (!q) return [];
    const hits = bulkModuleIndex.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        m.sectionLabel.toLowerCase().includes(q),
    );
    return hits.slice(0, 8);
  }, [bulkModuleSearch, bulkModuleIndex]);

  const scrollToBulkModule = (entry) => {
    const id =
      entry?.scrollId ||
      (entry?.key ? `bulk-module-${entry.key}` : null);
    const el = id ? document.getElementById(id) : null;
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const setRoleAndResetSelection = async (role) => {
    // Persist the in-progress selection for the current role before switching.
    persistBulkSelectionForRole(bulkRole, bulkSelectedModules);
    setBulkRole(role);
    setBulkTouched(false);
    const key = String(role || "").trim();
    const cached = bulkRoleSelections?.[key];
    if (Array.isArray(cached)) {
      setBulkSelectedModules(cached);
    } else {
      const fromDB = await fetchRoleModulesFromDB(role);
      setBulkSelectedModules(fromDB);
    }
  };

  const toggleBulkChild = (key) => {
    setBulkTouched(true);
    setBulkSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleBulkGroup = (node) => {
    setBulkTouched(true);
    const keys = collectModuleKeysFromUiNode(node);
    if (keys.length === 0) return;
    setBulkSelectedModules((prev) => {
      const alreadyAllChecked = keys.every((k) => prev.includes(k));
      if (alreadyAllChecked) {
        return prev.filter((k) => !keys.includes(k));
      }
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return [...next];
    });
  };

  const toggleBulkAll = () => {
    setBulkTouched(true);
    const allSelected = ALL_MODULE_KEYS.every((k) => bulkSelectedModules.includes(k));
    setBulkSelectedModules(allSelected ? [] : [...ALL_MODULE_KEYS]);
  };

  const submitBulkModules = async () => {
    const roles = [String(bulkRole || "").trim()].filter(Boolean);
    if (roles.length === 0) {
      toast.error("Select a role.");
      return;
    }
    setBulkSaving(true);
    try {
      const res = await fetch("/api/admin/bulk-module-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles,
          operation: bulkOperation,
          moduleKeys: bulkSelectedModules,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to apply module access.");
      }
      toast.success(`Applied to ${data.updated ?? 0} users`);
      // Clear cached state so next open fetches fresh from DB
      const key = String(bulkRole || "").trim();
      setBulkRoleSelections((prev) => {
        const next = { ...(prev || {}) };
        delete next[key];
        return next;
      });
      setShowGlobalModulesModal(false);
      router.refresh();
    } catch (e) {
      toast.error(e.message || "Failed to apply module access.");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 overflow-hidden">
      {/* ⭐ KPI SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-100 rounded shadow text-center">
          <h3 className="text-xl font-bold">{totalEmployees}</h3>
          <p className="text-gray-700 text-sm">Total Employees</p>
        </div>

        <div className="p-4 bg-green-100 rounded shadow text-center">
          <h3 className="text-xl font-bold">{activeEmployees}</h3>
          <p className="text-gray-700 text-sm">Active</p>
        </div>

        <div className="p-4 bg-red-100 rounded shadow text-center">
          <h3 className="text-xl font-bold">{inactiveEmployees}</h3>
          <p className="text-gray-700 text-sm">Inactive</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-4">
        <Link
          href="/admin-dashboard/create-employee"
          className="text-white bg-blue-600 hover:bg-blue-700 whitespace-nowrap font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center"
        >
          Add Employee
        </Link>
        <Link
          href="/admin-dashboard/ip-restrictions"
          className="text-white bg-red-600 hover:bg-red-700 font-medium whitespace-nowrap rounded-lg text-sm px-5 py-2.5 flex items-center justify-center space-x-2 shadow-md"
        >
          <Shield size={18} />
          <span>Global IP Settings</span>
        </Link>
        <button
          type="button"
          onClick={async () => {
            setBulkTouched(false);
            const key = String(bulkRole || "").trim();
            const cached = bulkRoleSelections?.[key];
            if (Array.isArray(cached)) {
              setBulkSelectedModules(cached);
            } else {
              const fromDB = await fetchRoleModulesFromDB(bulkRole);
              setBulkSelectedModules(fromDB);
            }
            setShowGlobalModulesModal(true);
          }}
          className="text-white bg-emerald-600 hover:bg-emerald-700 font-medium whitespace-nowrap rounded-lg text-sm px-5 py-2.5 flex items-center justify-center space-x-2 shadow-md"
        >
          <span>Global Module Access</span>
        </button>
      </div>

      {showGlobalModulesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Global Module Access (Role-wise)
              </h2>
              <button
                onClick={() => {
                  persistBulkSelectionForRole(bulkRole, bulkSelectedModules);
                  setShowGlobalModulesModal(false);
                }}
                className="text-gray-500 hover:text-gray-700 p-1"
                disabled={bulkSaving}
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800 mb-2">Roles</div>
                  <select
                    value={bulkRole}
                    onChange={(e) => setRoleAndResetSelection(e.target.value)}
                    disabled={bulkSaving || bulkRoleLoading}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {allRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {bulkRoleLoading && (
                    <p className="text-xs text-blue-500 mt-1">Loading from DB...</p>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-800 mb-2">Operation</div>
                  <select
                    value={bulkOperation}
                    onChange={(e) => setBulkOperation(e.target.value)}
                    disabled={bulkSaving}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="REPLACE">Replace (overwrite)</option>
                    <option value="MERGE">Merge (add)</option>
                    <option value="REMOVE">Remove selected</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Role caps & restrictions will still apply.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleBulkAll}
                    disabled={bulkSaving}
                    className="text-xs font-medium px-3 py-2 rounded-md border bg-gray-50 hover:bg-gray-100"
                  >
                    Toggle All
                  </button>
                  <div className="text-xs text-gray-500">
                    {bulkSelectedModules.length} selected
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="text-sm font-semibold text-gray-800 mb-2">
                  Modules
                </div>
                <div className="relative mb-3">
                  <input
                    value={bulkModuleSearch}
                    onChange={(e) => setBulkModuleSearch(e.target.value)}
                    placeholder="Search modules..."
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    disabled={bulkSaving}
                  />
                  {bulkModuleSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg overflow-hidden">
                      {bulkModuleSuggestions.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setBulkModuleSearch("");
                            scrollToBulkModule(m);
                          }}
                        >
                          <div className="font-medium text-gray-800">{m.label}</div>
                          <div className="text-xs text-gray-500">{m.sectionLabel}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {bulkModuleTree.map((node) => (
                    <ModuleUiBlock
                      key={node.id}
                      node={node}
                      selected={bulkSelectedModules}
                      disabled={bulkSaving}
                      onToggleGroup={toggleBulkGroup}
                      onToggleChild={toggleBulkChild}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  persistBulkSelectionForRole(bulkRole, bulkSelectedModules);
                  setShowGlobalModulesModal(false);
                }}
                disabled={bulkSaving}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBulkModules}
                disabled={bulkSaving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {bulkSaving ? "Applying..." : "Apply to Roles"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Reporting Manager Modal */}
      {showReportingManagerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Add Reporting Manager
              </h2>
              <button
                onClick={() => setShowReportingManagerModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee
                </label>
                <p className="p-2 bg-gray-100 rounded-md text-gray-800 font-medium">
                  {selectedEmployee || "-"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reporting Manager
                </label>
                <SearchableSelect
                  value={selectedReportingManager}
                  onChange={setSelectedReportingManager}
                  placeholder="-- Select Reporting Manager --"
                  searchPlaceholder="Search by name or role..."
                  options={[
                    { value: "", label: "-- Select Reporting Manager --" },
                    ...employeeList
                      .filter((emp) => emp.username !== selectedEmployee)
                      .map((emp) => ({
                        value: emp.username,
                        label: `${emp.username}${emp.userRole ? ` (${emp.userRole})` : ""}`,
                      })),
                  ]}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowReportingManagerModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReportingManager}
                disabled={savingReportingManager}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingReportingManager ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
        <input
          type="text"
          placeholder="Search employees..."
          className="w-full sm:flex-1 p-2 border border-gray-300 rounded-md min-w-0"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="p-2 border rounded-md w-full sm:w-auto min-w-[140px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* VIEW */}
      {isMobile ? (
        <div className="space-y-4">
          {filteredEmployees.length ? (
            filteredEmployees.map((employee) => (
              <EmployeeCard
                key={employee.empId}
                employee={employee}
                handleImpersonateLogin={handleImpersonateLogin}
                handleOpenReportingManagerModal={handleOpenReportingManagerModal}
                maskEmail={maskEmail}
                maskNumber={maskNumber}
                maskStatus={maskStatus}
              />
            ))
          ) : (
            <div className="text-center text-gray-500 py-4">
              No employees found.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          <table className="min-w-[900px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Name
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Email
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Number
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Emp ID
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Role
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Manager
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length ? (
                filteredEmployees.map((employee) => (
                  <tr key={employee.empId} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">{employee.username}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">{maskEmail(employee.email)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">{maskNumber(employee.number)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">{employee.empId}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">{employee.userRole}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">
                      {employee.reporting_manager || "-"}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">{maskStatus(employee.status)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex flex-wrap gap-2 sm:gap-4">
                        <button
                          onClick={() => handleImpersonateLogin(employee.empId)}
                          className="text-blue-600"
                        >
                          <LogIn size={20} />
                        </button>

                        <Link
                          href={`/admin-dashboard/password/${employee.username}`}
                          className="text-yellow-600"
                        >
                          <Key size={20} />
                        </Link>

                        <Link
                          href={`/admin-dashboard/quick-edit/${employee.username}`}
                          className="text-green-600"
                        >
                          <Edit size={20} />
                        </Link>

                        <Link
                          href={`/admin-dashboard/ip-restrictions/${employee.username}`}
                          className="text-purple-600"
                          title="IP Restriction Settings"
                        >
                          <Shield size={20} />
                        </Link>

                        <button
                          onClick={() => handleOpenReportingManagerModal(employee)}
                          className="text-indigo-600 hover:text-indigo-800"
                          title="Add Reporting Manager"
                        >
                          <UserPlus size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-gray-500">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmpTable;
