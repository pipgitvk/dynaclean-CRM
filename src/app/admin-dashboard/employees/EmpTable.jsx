// app/EmpTable.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Link from "next/link";
import { LogIn, Key, Edit, Shield, UserPlus, X } from "lucide-react";
import SearchableSelect from "@/components/ui/SearchableSelect";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [isMobile, setIsMobile] = useState(false);
  const [showReportingManagerModal, setShowReportingManagerModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedReportingManager, setSelectedReportingManager] = useState("");
  const [savingReportingManager, setSavingReportingManager] = useState(false);
  const [employeeList, setEmployeeList] = useState([]);
  const router = useRouter();

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
      </div>

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
