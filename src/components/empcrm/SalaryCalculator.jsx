// src/components/empcrm/SalaryCalculator.jsx
"use client";

import { useState } from "react";
import { Calculator, Save, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

const SalaryCalculator = ({ employee, onCalculate }) => {
  const [formData, setFormData] = useState({
    salary_month: "",
    working_days: 22,
    present_days: 22,
    overtime_hours: 0
  });
  const [loading, setLoading] = useState(false);
  const [calculatedSalary, setCalculatedSalary] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    
    if (!formData.salary_month) {
      toast.error("Please select a salary month");
      return;
    }

    if (formData.present_days > formData.working_days) {
      toast.error("Present days cannot be more than working days");
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch("/api/empcrm/salary/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: employee.username,
          ...formData
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCalculatedSalary(data.salaryData);
        toast.success("Salary calculated successfully");
        if (onCalculate) {
          onCalculate();
        }
      } else {
        toast.error(data.message || "Failed to calculate salary");
      }
    } catch (error) {
      console.error("Error calculating salary:", error);
      toast.error("Error calculating salary");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <Calculator className="w-5 h-5 mr-2 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Calculate Salary</h3>
      </div>

      <form onSubmit={handleCalculate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Salary Month
            </label>
            <input
              type="month"
              name="salary_month"
              value={formData.salary_month}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Working Days
            </label>
            <input
              type="number"
              name="working_days"
              value={formData.working_days}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="31"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Present Days
            </label>
            <input
              type="number"
              name="present_days"
              value={formData.present_days}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              max={formData.working_days}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overtime Hours
            </label>
            <input
              type="number"
              name="overtime_hours"
              value={formData.overtime_hours}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.5"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Calculator className="w-4 h-4 mr-2" />
          )}
          {loading ? "Calculating..." : "Calculate Salary"}
        </button>
      </form>

      {calculatedSalary && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Calculation Result</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Basic Salary:</span>
                <span className="text-sm font-medium">{formatCurrency(calculatedSalary.basicSalary)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">HRA:</span>
                <span className="text-sm font-medium">{formatCurrency(calculatedSalary.hra)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Transport Allowance:</span>
                <span className="text-sm font-medium">{formatCurrency(calculatedSalary.transportAllowance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Medical Allowance:</span>
                <span className="text-sm font-medium">{formatCurrency(calculatedSalary.medicalAllowance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Special Allowance:</span>
                <span className="text-sm font-medium">{formatCurrency(calculatedSalary.specialAllowance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Overtime:</span>
                <span className="text-sm font-medium">{formatCurrency(calculatedSalary.overtimeAmount)}</span>
              </div>
              <hr className="border-gray-300" />
              <div className="flex justify-between font-semibold">
                <span className="text-sm">Total Earnings:</span>
                <span className="text-sm text-green-600">{formatCurrency(calculatedSalary.totalEarnings)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 mb-2">Deductions:</div>
              {calculatedSalary.deductionDetails.map((deduction, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-sm text-gray-600">{deduction.deduction_name}:</span>
                  <span className="text-sm font-medium">{formatCurrency(deduction.amount)}</span>
                </div>
              ))}
              <hr className="border-gray-300" />
              <div className="flex justify-between font-semibold">
                <span className="text-sm">Total Deductions:</span>
                <span className="text-sm text-red-600">{formatCurrency(calculatedSalary.totalDeductions)}</span>
              </div>
              <hr className="border-gray-300" />
              <div className="flex justify-between font-bold text-lg">
                <span>Net Salary:</span>
                <span className="text-blue-600">{formatCurrency(calculatedSalary.netSalary)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryCalculator;
