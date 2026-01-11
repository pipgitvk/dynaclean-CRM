// src/app/empcrm/admin-dashboard/salary/page.jsx
"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Calculator,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

const SalaryManagementPage = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [salaryData, setSalaryData] = useState(null);
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter(); // Need to import useRouter at top

  // Salary form state
  const [salaryForm, setSalaryForm] = useState({
    username: "",
    basic_salary: "",
    hra: "",
    transport_allowance: "",
    medical_allowance: "",
    special_allowance: "",
    bonus: "",
    overtime_rate: "",
    effective_from: ""
  });

  // Deduction form state
  const [deductionForm, setDeductionForm] = useState({
    username: "",
    deduction_type_id: "",
    amount: "",
    effective_from: "",
    effective_to: "",
    reason: ""
  });
  const [deductionLastEdited, setDeductionLastEdited] = useState("amount");

  // Derived totals for selected employee
  const grossBase = useMemo(() => {
    if (!salaryData?.salaryStructure) return 0;
    const s = salaryData.salaryStructure;
    const toNumber = (v) => (v ? Number(v) : 0);
    return (
      toNumber(s.basic_salary) +
      toNumber(s.hra) +
      toNumber(s.transport_allowance) +
      toNumber(s.medical_allowance) +
      toNumber(s.special_allowance) +
      toNumber(s.bonus)
    );
  }, [salaryData]);

  const totalActiveDeductions = useMemo(() => {
    if (!salaryData?.deductions) return 0;
    return salaryData.deductions.reduce((sum, d) => {
      const amount = Number(d.amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [salaryData, grossBase]);

  const previewNewDeductionAmount = useMemo(() => {
    const amt = deductionForm.amount === "" ? 0 : Number(deductionForm.amount);
    return isNaN(amt) ? 0 : amt;
  }, [deductionForm, grossBase]);

  const totalDeductionsWithPreview = totalActiveDeductions + previewNewDeductionAmount;
  const netAfterPreview = Math.max(0, grossBase - totalDeductionsWithPreview);
  const netPayableCurrent = Math.max(0, grossBase - totalActiveDeductions);

  useEffect(() => {
    fetchEmployees();
    fetchDeductionTypes();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeSalaryData(selectedEmployee);
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/empcrm/employees");
      const data = await response.json();

      if (data.success) {
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Error fetching employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeductionTypes = async () => {
    try {
      const response = await fetch("/api/empcrm/salary/deductions");
      const data = await response.json();

      if (data.success) {
        setDeductionTypes(data.deductionTypes || []);
      }
    } catch (error) {
      console.error("Error fetching deduction types:", error);
    }
  };

  const fetchEmployeeSalaryData = async (username) => {
    try {
      const response = await fetch(`/api/empcrm/salary?username=${username}`);
      const data = await response.json();

      if (data.success) {
        setSalaryData(data);
      }
    } catch (error) {
      console.error("Error fetching salary data:", error);
      toast.error("Error fetching salary data");
    }
  };

  const handleSalarySubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/empcrm/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salaryForm)
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Salary structure updated successfully");
        setShowSalaryForm(false);
        setSalaryForm({
          username: "",
          basic_salary: "",
          hra: "",
          transport_allowance: "",
          medical_allowance: "",
          special_allowance: "",
          bonus: "",
          overtime_rate: "",
          effective_from: ""
        });
        if (selectedEmployee) {
          fetchEmployeeSalaryData(selectedEmployee);
        }
      } else {
        toast.error(data.message || "Failed to update salary structure");
      }
    } catch (error) {
      console.error("Error updating salary structure:", error);
      toast.error("Error updating salary structure");
    }
  };

  const handleDeductionSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = editingDeduction
        ? "/api/empcrm/salary/deductions"
        : "/api/empcrm/salary/deductions";
      const method = editingDeduction ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deductionForm,
          deduction_id: editingDeduction?.id
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingDeduction ? "Deduction updated successfully" : "Deduction added successfully");
        setShowDeductionForm(false);
        setEditingDeduction(null);
        setDeductionForm({
          username: "",
          deduction_type_id: "",
          amount: "",
          effective_from: "",
          effective_to: "",
          reason: ""
        });
        if (selectedEmployee) {
          fetchEmployeeSalaryData(selectedEmployee);
        }
      } else {
        toast.error(data.message || "Failed to save deduction");
      }
    } catch (error) {
      console.error("Error saving deduction:", error);
      toast.error("Error saving deduction");
    }
  };

  const handleDeleteDeduction = async (deductionId) => {
    if (!confirm("Are you sure you want to delete this deduction?")) return;

    try {
      const response = await fetch(`/api/empcrm/salary/deductions?id=${deductionId}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Deduction deleted successfully");
        if (selectedEmployee) {
          fetchEmployeeSalaryData(selectedEmployee);
        }
      } else {
        toast.error(data.message || "Failed to delete deduction");
      }
    } catch (error) {
      console.error("Error deleting deduction:", error);
      toast.error("Error deleting deduction");
    }
  };

  const openSalaryForm = (employee = null) => {
    if (employee) {
      setSalaryForm({
        username: employee.username,
        basic_salary: "",
        hra: "",
        transport_allowance: "",
        medical_allowance: "",
        special_allowance: "",
        bonus: "",
        overtime_rate: "",
        effective_from: new Date().toISOString().split('T')[0]
      });
    }
    setShowSalaryForm(true);
  };

  const openDeductionForm = (employee = null, deduction = null) => {
    if (employee) {
      setDeductionForm({
        username: employee.username,
        deduction_type_id: "",
        amount: "",
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: "",
        reason: ""
      });
    }
    if (deduction) {
      setEditingDeduction(deduction);
      setDeductionForm({
        username: selectedEmployee,
        deduction_type_id: deduction.deduction_type_id,
        amount: deduction.amount,
        effective_from: deduction.effective_from,
        effective_to: deduction.effective_to || "",
        reason: deduction.reason || ""
      });
    }
    setShowDeductionForm(true);
  };

  // Bi-directional auto-calc between amount and percentage
  const handleDeductionAmountChange = (value) => {
    const amount = value === "" ? "" : Number(value);
    setDeductionLastEdited("amount");
    setDeductionForm({ ...deductionForm, amount: value });
  };

  const handleDeductionPercentageChange = (value) => {
    const percentage = value === "" ? "" : Number(value);
    let amount = deductionForm.amount;
    if (grossBase > 0 && value !== "") {
      const amt = (grossBase * Number(percentage)) / 100;
      amount = isNaN(amt) ? "" : Number(amt.toFixed(2));
    }
    setDeductionLastEdited("percentage");
    setDeductionForm({ ...deductionForm, percentage: value, amount });
  };

  const filteredEmployees = employees.filter(emp =>
    emp.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 text-lg mt-4">Loading salary management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Salary Management</h1>
        <p className="text-gray-600">Manage employee salary structures and deductions</p>
      </div>

      {/* Employee Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="w-full md:max-w-xl">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose an employee...</option>
              {employees.map((emp) => (
                <option key={emp.empId} value={emp.username}>
                  {emp.username} {emp.full_name ? `- ${emp.full_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => router.push('/empcrm/admin-dashboard/salary/generate')}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Generate Salary
            </button>
            <button
              onClick={() => selectedEmployee ? openSalaryForm({ username: selectedEmployee }) : openSalaryForm()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedEmployee}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add / Edit Structure
            </button>
          </div>
        </div>
      </div>

      {/* Selected Employee Details */}
      {selectedEmployee && salaryData && (
        <div className="space-y-8">
          {/* Net Payable Summary */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-700">Gross (Structure Sum)</p>
                <p className="text-2xl font-bold text-blue-900">₹{Math.round(grossBase).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Active Deductions</p>
                <p className="text-2xl font-bold text-blue-900">- ₹{Math.round(totalActiveDeductions).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Net Payable (Current)</p>
                <p className="text-2xl font-bold text-green-700">₹{Math.round(netPayableCurrent).toLocaleString()}</p>
              </div>
            </div>
          </div>
          {/* Current Salary Structure */}
          {salaryData.salaryStructure && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Current Salary Structure</h3>
                <button
                  onClick={() => openSalaryForm({ username: selectedEmployee })}
                  className="text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Basic Salary</p>
                  <p className="text-xl font-bold text-blue-600">
                    ₹{salaryData.salaryStructure.basic_salary?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">HRA</p>
                  <p className="text-xl font-bold text-green-600">
                    ₹{salaryData.salaryStructure.hra?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Transport Allowance</p>
                  <p className="text-xl font-bold text-purple-600">
                    ₹{salaryData.salaryStructure.transport_allowance?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Medical Allowance</p>
                  <p className="text-xl font-bold text-orange-600">
                    ₹{salaryData.salaryStructure.medical_allowance?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Special Allowance</p>
                  <p className="text-xl font-bold text-indigo-600">
                    ₹{salaryData.salaryStructure.special_allowance?.toLocaleString()}
                  </p>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Overtime Rate</p>
                  <p className="text-xl font-bold text-pink-600">
                    ₹{salaryData.salaryStructure.overtime_rate?.toLocaleString()}/hr
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg col-span-1 md:col-span-2 lg:col-span-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-gray-600">Estimated Gross (structure sum)</p>
                    <p className="text-2xl font-bold text-gray-800">₹{Math.round(grossBase).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deductions Management */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Active Deductions</h3>
              <button
                onClick={() => openDeductionForm({ username: selectedEmployee })}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Deduction
              </button>
            </div>

            {salaryData.deductions && salaryData.deductions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Deduction Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Effective From
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salaryData.deductions.map((deduction, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {deduction.deduction_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{deduction.amount?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(deduction.effective_from).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {deduction.reason || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openDeductionForm(null, deduction)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDeduction(deduction.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No deductions found for this employee.</p>
              </div>
            )}
          </div>

          {/* Salary History */}
          {salaryData.salaryRecords && salaryData.salaryRecords.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary History</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Month
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Present Days
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gross Salary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Deductions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Net Salary
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salaryData.salaryRecords.map((record, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(record.salary_month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.present_days}/{record.working_days}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{record.gross_salary?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{record.total_deductions?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          ₹{record.net_salary?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === 'paid' ? 'bg-green-100 text-green-800' :
                            record.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                              record.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                            }`}>
                            {record.status?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Salary Structure Modal */}
      {showSalaryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary Structure</h3>
            <form onSubmit={handleSalarySubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    value={salaryForm.username}
                    onChange={(e) => setSalaryForm({ ...salaryForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.empId} value={emp.username}>{emp.username} - {emp.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={salaryForm.effective_from}
                    onChange={(e) => setSalaryForm({ ...salaryForm, effective_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
                  <input
                    type="number"
                    value={salaryForm.basic_salary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, basic_salary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HRA</label>
                  <input
                    type="number"
                    value={salaryForm.hra}
                    onChange={(e) => setSalaryForm({ ...salaryForm, hra: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transport Allowance</label>
                  <input
                    type="number"
                    value={salaryForm.transport_allowance}
                    onChange={(e) => setSalaryForm({ ...salaryForm, transport_allowance: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medical Allowance</label>
                  <input
                    type="number"
                    value={salaryForm.medical_allowance}
                    onChange={(e) => setSalaryForm({ ...salaryForm, medical_allowance: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Allowance</label>
                  <input
                    type="number"
                    value={salaryForm.special_allowance}
                    onChange={(e) => setSalaryForm({ ...salaryForm, special_allowance: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bonus</label>
                  <input
                    type="number"
                    value={salaryForm.bonus}
                    onChange={(e) => setSalaryForm({ ...salaryForm, bonus: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Rate (per hour)</label>
                  <input
                    type="number"
                    value={salaryForm.overtime_rate}
                    onChange={(e) => setSalaryForm({ ...salaryForm, overtime_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSalaryForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Salary Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deduction Modal */}
      {showDeductionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 m-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingDeduction ? 'Edit Deduction' : 'Add Deduction'}
            </h3>
            <form onSubmit={handleDeductionSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    value={deductionForm.username}
                    onChange={(e) => setDeductionForm({ ...deductionForm, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.empId} value={emp.username}>{emp.username} - {emp.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deduction Type</label>
                  <select
                    value={deductionForm.deduction_type_id}
                    onChange={(e) => setDeductionForm({ ...deductionForm, deduction_type_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Deduction Type</option>
                    {deductionTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.deduction_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    value={deductionForm.amount}
                    onChange={(e) => setDeductionForm({ ...deductionForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={deductionForm.effective_from}
                    onChange={(e) => setDeductionForm({ ...deductionForm, effective_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective To</label>
                  <input
                    type="date"
                    value={deductionForm.effective_to}
                    onChange={(e) => setDeductionForm({ ...deductionForm, effective_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={deductionForm.reason}
                  onChange={(e) => setDeductionForm({ ...deductionForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Enter reason for deduction"
                />
              </div>
              {/* Live preview */}
              <div className="mt-2 p-3 rounded-md bg-gray-50 border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between text-sm">
                  <span className="text-gray-700">Estimated Gross</span>
                  <span className="font-semibold">₹{Math.round(grossBase).toLocaleString()}</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between text-sm mt-1">
                  <span className="text-gray-700">Current Active Deductions</span>
                  <span className="font-semibold">- ₹{Math.round(totalActiveDeductions).toLocaleString()}</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between text-sm mt-1">
                  <span className="text-gray-700">This Deduction (preview)</span>
                  <span className="font-semibold">- ₹{Math.round(previewNewDeductionAmount).toLocaleString()}</span>
                </div>
                <hr className="my-2" />
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <span className="font-medium text-gray-900">Estimated Net Pay</span>
                  <span className="font-bold text-green-700">
                    ₹{Math.round(netAfterPreview).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeductionForm(false);
                    setEditingDeduction(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  {editingDeduction ? 'Update Deduction' : 'Add Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryManagementPage;