// app/EmpTable.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Link from "next/link";
import { LogIn, Key, Edit, Shield } from "lucide-react";

const EmployeeCard = ({
  employee,
  handleImpersonateLogin,
  maskEmail,
  maskNumber,
  maskStatus,
}) => (
  <div className="bg-white shadow-md rounded-lg p-4 mb-4 border border-gray-200 mobile-card">
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

    <div className="mb-4">
      <span className="font-semibold text-gray-700">User Role:</span>
      <p className="text-gray-600">{employee.userRole}</p>
    </div>

    <div className="mb-4">
      <span className="font-semibold text-gray-700">Status:</span>
      <p className="text-gray-600">{maskStatus(employee.status)}</p>
    </div>

    <div className="flex justify-between items-center">
      <button
        onClick={() => handleImpersonateLogin(employee.empId)}
        className="text-blue-600 hover:text-blue-900 font-medium flex items-center space-x-1"
      >
        <LogIn size={18} />
        <span>Login</span>
      </button>

      <Link
        href={`/admin-dashboard/password/${employee.username}`}
        className="text-yellow-600 hover:text-yellow-900 font-medium flex items-center space-x-1"
      >
        <Key size={18} />
        <span>Password</span>
      </Link>

      <Link
        href={`/admin-dashboard/quick-edit/${employee.username}`}
        className="text-green-600 hover:text-green-900 font-medium flex items-center space-x-1"
      >
        <Edit size={18} />
        <span>Edit</span>
      </Link>

      <Link
        href={`/admin-dashboard/ip-restrictions/${employee.username}`}
        className="text-purple-600 hover:text-purple-900 font-medium flex items-center space-x-1"
      >
        <Shield size={18} />
        <span>IP</span>
      </Link>
    </div>
  </div>
);

const EmpTable = ({ employees }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleImpersonateLogin = async (empId) => {
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
        alert(data.error);
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
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
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
    <div className="bg-white shadow-md rounded-lg p-6">

      {/* ⭐ KPI SECTION */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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

      <div className="flex flex-wrap gap-4 mb-4">
        <Link
          href="/user-dashboard/create-employee"
          className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5 inline-block"
        >
          Add Employee
        </Link>
        <Link
          href="/admin-dashboard/ip-restrictions"
          className="text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 inline-block flex items-center space-x-2 shadow-md"
        >
          <Shield size={18} />
          <span>Global IP Settings</span>
        </Link>
      </div>

      {/* ⭐ FILTERS */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search employees..."
          className="w-full p-2 border border-gray-300 rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="p-2 border rounded-md"
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium">Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium">Emp ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium">
                  User Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length ? (
                filteredEmployees.map((employee) => (
                  <tr key={employee.empId}>
                    <td className="px-6 py-4">{employee.username}</td>
                    <td className="px-6 py-4">{maskEmail(employee.email)}</td>
                    <td className="px-6 py-4">{maskNumber(employee.number)}</td>
                    <td className="px-6 py-4">{employee.empId}</td>
                    <td className="px-6 py-4">{employee.userRole}</td>
                    <td className="px-6 py-4">{maskStatus(employee.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4">
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
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-gray-500">
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
