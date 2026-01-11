// src/app/empcrm/user-dashboard/salary/page.jsx
"use client";

import { useState, useEffect } from "react";
import { Calendar, Download, Eye, AlertCircle, CheckCircle, Clock, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { generatePayslipPDF, downloadPayslip } from "@/utils/payslipGenerator";

const SalaryPage = () => {
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    fetchUserData();
    fetchSalaryData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();
      if (data.success) {
        setUserData(data.user);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchSalaryData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/empcrm/salary");
      const data = await response.json();

      if (data.success) {
        setSalaryData(data);
        // Set current month as default
        const currentMonth = new Date().toISOString().slice(0, 7);
        setSelectedMonth(currentMonth);
      } else {
        toast.error(data.message || "Failed to fetch salary data");
      }
    } catch (error) {
      console.error("Error fetching salary data:", error);
      toast.error("Error fetching salary data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'draft':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return "bg-green-100 text-green-800";
      case 'approved':
        return "bg-blue-100 text-blue-800";
      case 'draft':
        return "bg-yellow-100 text-yellow-800";
      case 'cancelled':
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatMonth = (monthString) => {
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const selectedSalaryRecord = salaryData?.salaryRecords?.find(
    record => record.salary_month === selectedMonth
  );

  const formatINR = (n) => new Intl.NumberFormat('en-IN').format(Math.round(Number(n || 0)));

  const handleDownloadPayslip = async () => {
    if (!selectedSalaryRecord) return;

    const toastId = toast.loading("Generating Payslip...");
    try {
      // selectedSalaryRecord now contains all profile data from the JOIN
      const pdf = await generatePayslipPDF(selectedSalaryRecord, selectedSalaryRecord);
      downloadPayslip(pdf, `Payslip_${selectedSalaryRecord.salary_month}.pdf`);
      toast.success("Payslip downloaded successfully", { id: toastId });
    } catch (error) {
      console.error("Error downloading payslip:", error);
      toast.error("Failed to generate payslip", { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 text-lg mt-4">Loading salary data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Salary</h1>
        {userData && (
          <p className="text-gray-600">
            Welcome, <span className="font-semibold">{userData.username}</span>
          </p>
        )}
      </div>

      {/* Current Salary Structure */}
      {salaryData?.salaryStructure && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Current Salary Structure
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Basic Salary</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(salaryData.salaryStructure.basic_salary)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">HRA</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(salaryData.salaryStructure.hra)}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Transport Allowance</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(salaryData.salaryStructure.transport_allowance)}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Medical Allowance</p>
              <p className="text-xl font-bold text-orange-600">
                {formatCurrency(salaryData.salaryStructure.medical_allowance)}
              </p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Special Allowance</p>
              <p className="text-xl font-bold text-indigo-600">
                {formatCurrency(salaryData.salaryStructure.special_allowance)}
              </p>
            </div>
            <div className="bg-pink-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Overtime Rate (per hour)</p>
              <p className="text-xl font-bold text-pink-600">
                {formatCurrency(salaryData.salaryStructure.overtime_rate)}
              </p>
            </div>
            {/* Totals summary */}
            <div className="bg-gray-50 p-4 rounded-lg md:col-span-2 lg:col-span-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <span className="text-sm text-gray-700">Estimated Gross (structure sum)</span>
                <span className="text-2xl font-bold text-gray-900">
                  ₹{formatINR(
                    Number(salaryData.salaryStructure.basic_salary || 0) +
                    Number(salaryData.salaryStructure.hra || 0) +
                    Number(salaryData.salaryStructure.transport_allowance || 0) +
                    Number(salaryData.salaryStructure.medical_allowance || 0) +
                    Number(salaryData.salaryStructure.special_allowance || 0) +
                    Number(salaryData.salaryStructure.bonus || 0)
                  )}
                </span>
              </div>
              {salaryData?.deductions?.length > 0 && (
                <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between">
                  <span className="text-sm text-gray-700">Active Deductions (current)</span>
                  <span className="text-xl font-bold text-gray-900">
                    ₹{formatINR(
                      salaryData.deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0)
                    )}
                  </span>
                </div>
              )}
              <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between">
                <span className="text-sm text-gray-900 font-medium">Net Payable (Current)</span>
                <span className="text-2xl font-bold text-green-700">
                  ₹{formatINR(
                    (Number(salaryData.salaryStructure.basic_salary || 0) +
                      Number(salaryData.salaryStructure.hra || 0) +
                      Number(salaryData.salaryStructure.transport_allowance || 0) +
                      Number(salaryData.salaryStructure.medical_allowance || 0) +
                      Number(salaryData.salaryStructure.special_allowance || 0) +
                      Number(salaryData.salaryStructure.bonus || 0)) -
                    (salaryData?.deductions?.reduce((sum, d) => sum + Number(d.amount || 0), 0) || 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Deductions */}
      {salaryData?.deductions && salaryData.deductions.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Deductions</h2>
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaryData.deductions.map((deduction, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {deduction.deduction_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {deduction.percentage
                        ? `${deduction.percentage}%`
                        : formatCurrency(deduction.amount)
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(deduction.effective_from).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {deduction.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salary Records */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 md:mb-0">Salary History</h2>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Select Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {salaryData?.salaryRecords?.map((record) => (
                <option key={record.salary_month} value={record.salary_month}>
                  {formatMonth(record.salary_month)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedSalaryRecord ? (
          <div className="space-y-6">
            {/* Status and Summary */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {getStatusIcon(selectedSalaryRecord.status)}
                <div>
                  <p className="font-semibold text-gray-900">
                    {formatMonth(selectedSalaryRecord.salary_month)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedSalaryRecord.present_days} days present out of {selectedSalaryRecord.working_days} working days
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedSalaryRecord.net_salary)}
                </p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedSalaryRecord.status)}`}>
                  {selectedSalaryRecord.status.toUpperCase()}
                </span>
                <button
                  onClick={handleDownloadPayslip}
                  className="ml-4 mt-2 px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 flex items-center justify-center w-full md:w-auto"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Download Payslip
                </button>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Earnings */}
              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 mb-4">Earnings</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Basic Salary</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.basic_salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">HRA</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.hra)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transport Allowance</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.transport_allowance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medical Allowance</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.medical_allowance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Special Allowance</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.special_allowance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bonus</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.bonus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Overtime ({selectedSalaryRecord.overtime_hours} hrs)</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.overtime_amount)}</span>
                  </div>
                  <hr className="border-green-200" />
                  <div className="flex justify-between font-bold text-green-800">
                    <span>Total Earnings</span>
                    <span>{formatCurrency(selectedSalaryRecord.total_earnings)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="bg-red-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-red-800 mb-4">Deductions</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Provident Fund</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.pf_deduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ESI</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.esi_deduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Income Tax</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.income_tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Professional Tax</span>
                    <span className="font-medium">{formatCurrency(selectedSalaryRecord.professional_tax)}</span>
                  </div>
                  {/* Dynamic Other Deductions */}
                  {selectedSalaryRecord.deduction_details && selectedSalaryRecord.deduction_details.length > 0 ? (
                    selectedSalaryRecord.deduction_details
                      .filter(d => !['Provident Fund', 'ESI', 'Income Tax', 'Professional Tax'].includes(d.deduction_name))
                      .map((deduction, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-gray-600">{deduction.deduction_name}</span>
                          <span className="font-medium">{formatCurrency(deduction.amount)}</span>
                        </div>
                      ))
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Other Deductions</span>
                      <span className="font-medium">{formatCurrency(selectedSalaryRecord.other_deductions)}</span>
                    </div>
                  )}
                  <hr className="border-red-200" />
                  <div className="flex justify-between font-bold text-red-800">
                    <span>Total Deductions</span>
                    <span>{formatCurrency(selectedSalaryRecord.total_deductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary */}
            <div className="bg-blue-50 p-6 rounded-lg text-center">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Net Salary</h3>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(selectedSalaryRecord.net_salary)}
              </p>
              <p className="text-sm text-blue-600 mt-2">
                Gross: {formatCurrency(selectedSalaryRecord.gross_salary)} - Deductions: {formatCurrency(selectedSalaryRecord.total_deductions)}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No salary record found</h3>
            <p className="text-gray-500">No salary data available for the selected month.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalaryPage;
