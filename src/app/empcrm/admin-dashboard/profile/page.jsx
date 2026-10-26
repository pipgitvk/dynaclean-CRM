"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, FileText, History, X, TrendingUp } from "lucide-react";
import ProfileForm from "./ProfileForm";

export default function ProfileManagement() {
  const searchParams = useSearchParams();
  const presetUsername = searchParams.get("username") || "";

  const [employees, setEmployees] = useState([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [entryMode, setEntryMode] = useState("manual");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSalaryHistory, setShowSalaryHistory] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salaryHistoryLoading, setSalaryHistoryLoading] = useState(false);

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

  // Auto-select employee when coming from Edit button with ?username= in URL
  useEffect(() => {
    if (presetUsername && employees.length > 0 && !selectedUsername) {
      const emp = employees.find(
        (e) => e.username.toLowerCase() === presetUsername.toLowerCase()
      );
      if (emp) {
        setSelectedUsername(emp.username);
        setSelectedEmployee(emp);
      }
    }
  }, [presetUsername, employees]);

  const filteredEmployees = employees.filter((emp) =>
    emp.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchSalaryHistory = async (username) => {
    setSalaryHistoryLoading(true);
    try {
      const response = await fetch(`/api/empcrm/salary/history?username=${username}`);
      const data = await response.json();
      if (data.success) {
        setSalaryHistory(data.history);
      }
    } catch (error) {
      console.error("Error fetching salary history:", error);
    } finally {
      setSalaryHistoryLoading(false);
    }
  };

  const handleSalaryHistoryClick = () => {
    if (selectedUsername) {
      setShowSalaryHistory(true);
      fetchSalaryHistory(selectedUsername);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Profile Management</h1>
            <p className="text-gray-600 mt-2">Create and manage employee profiles</p>
          </div>
          <div className="flex gap-3">
            {selectedUsername && (
              <button
                onClick={handleSalaryHistoryClick}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
              >
                <History className="w-4 h-4" />
                Salary History
              </button>
            )}
            <a href="/empcrm/admin-dashboard/profile/approvals" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              Go to Approvals
            </a>
          </div>
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

      {/* Salary History Modal */}
      {showSalaryHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Salary History - {selectedUsername}
              </h2>
              <button
                onClick={() => setShowSalaryHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {salaryHistoryLoading ? (
                <div className="text-center py-8">Loading salary history...</div>
              ) : salaryHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No salary history found for this employee.</div>
              ) : (
                <div className="space-y-4">
                  {salaryHistory.map((record, index) => (
                    <div key={record.id} className={`border rounded-lg p-4 ${record.is_active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Effective From:</span> {new Date(record.effective_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-2">
                          {record.is_active && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Active</span>
                          )}
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Changed By:</span> {record.changed_by_name || record.created_by}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500 mb-1">Gross Salary</div>
                          <div className="font-semibold text-blue-700">₹{record.gross_salary || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Basic Salary</div>
                          <div className="font-semibold">₹{record.basic_salary || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">HRA</div>
                          <div className="font-semibold">₹{record.hra || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Special Allowance</div>
                          <div className="font-semibold">₹{record.special_allowance || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Transport</div>
                          <div className="font-semibold">₹{record.transport_allowance || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Medical</div>
                          <div className="font-semibold">₹{record.medical_allowance || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Bonus</div>
                          <div className="font-semibold">₹{record.bonus || 0}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Created At</div>
                          <div className="font-semibold">{new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                      {record.effective_to && (
                        <div className="mt-3 pt-3 border-t border-gray-200 text-sm">
                          <span className="font-medium">Effective To:</span> {new Date(record.effective_to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
