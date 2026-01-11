"use client";

import { useState, useEffect } from "react";
import { Search, FileText } from "lucide-react";
import ProfileForm from "./ProfileForm";

export default function ProfileManagement() {
  const [employees, setEmployees] = useState([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [entryMode, setEntryMode] = useState("manual");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/empcrm/employees");
      const data = await response.json();
      if (data.success) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleUsernameSelect = async (username) => {
    setSelectedUsername(username);
    const employee = employees.find((emp) => emp.username === username);
    setSelectedEmployee(employee);
    
    console.log("Selected employee:", employee); // Debug log
    
    // Fetch existing profile if any
    try {
      const response = await fetch(`/api/empcrm/profile?username=${username}`);
      const data = await response.json();
      if (data.success && data.profile) {
        // Profile exists, you can pre-fill the form
        console.log("Existing profile:", data.profile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Profile Management</h1>
            <p className="text-gray-600 mt-2">Create and manage employee profiles</p>
          </div>
          <a href="/empcrm/admin-dashboard/profile/approvals" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
            Go to Approvals
          </a>
        </div>
      </div>

      {/* Step 1: Select Employee */}
      {!selectedUsername && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5" />
            Step 1: Select Employee
          </h2>
          
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {filteredEmployees.map((emp) => (
              <button
                key={emp.empId}
                onClick={() => handleUsernameSelect(emp.username)}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
              >
                <div className="font-semibold text-gray-800">{emp.username}</div>
                <div className="text-sm text-gray-600">EmpID: {emp.empId}</div>
                {emp.email && <div className="text-sm text-gray-500">{emp.email}</div>}
                {emp.userRole && (
                  <div className="text-xs text-blue-600 mt-1 bg-blue-100 inline-block px-2 py-1 rounded">
                    {emp.userRole}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Parser step removed - defaulting to manual entry */}

      {/* Step 3: Show Form */}
      {selectedUsername && (
        <ProfileForm
          username={selectedUsername}
          empId={selectedEmployee?.empId}
          entryMode={"manual"}
          onBack={() => {
            setSelectedUsername("");
            setSelectedEmployee(null);
          }}
        />
      )}
    </div>
  );
}
