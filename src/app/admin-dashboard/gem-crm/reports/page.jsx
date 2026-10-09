"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Download,
  Filter,
  FileText,
  Calendar,
  User,
  Building2,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import toast from "react-hot-toast";

export default function GemCrmReportsPage() {
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportType, setReportType] = useState("date-wise");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [organisationId, setOrganisationId] = useState("");
  const [platform, setPlatform] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAssignedEmployees();
  }, []);

  useEffect(() => {
    // Don't set default date range - show all data by default
    fetchReport();
  }, [reportType, employeeId, organisationId, platform]);

  const fetchAssignedEmployees = async () => {
    try {
      const res = await fetch("/api/gem-crm/assigned-employees");
      const result = await res.json();
      if (result.success) {
        setAssignedEmployees(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching assigned employees:", error);
    }
  };

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        reportType,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(employeeId && { employeeId }),
        ...(organisationId && { organisationId }),
        ...(platform && { platform }),
      });

      const res = await fetch(`/api/gem-crm/reports?${params}`);
      const result = await res.json();
      if (result.success) {
        setReportData(result.data);
      } else {
        toast.error("Failed to fetch report");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error("Error fetching report");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const params = new URLSearchParams({
        reportType,
        dateFrom,
        dateTo,
        ...(employeeId && { employeeId }),
        ...(organisationId && { organisationId }),
        ...(platform && { platform }),
        export: format,
      });

      const res = await fetch(`/api/gem-crm/reports?${params}`);
      
      if (format === "excel") {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gem-crm-report-${reportType}-${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Report exported successfully");
      }
    } catch (error) {
      console.error("Error exporting report:", error);
      toast.error("Error exporting report");
    }
  };

  const getReportTitle = () => {
    const titles = {
      "date-wise": "Date-wise Bids Report",
      "employee-wise": "Employee-wise Bids Report",
      "organisation-wise": "Organisation-wise Bids Report",
      "platform-wise": "Platform-wise Bids Report",
      "won-lost": "Won/Lost Analysis Report",
      "financial": "Financial Report",
    };
    return titles[reportType] || "Bids Report";
  };

  const renderTable = () => {
    if (reportData.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No data available for the selected filters</p>
        </div>
      );
    }

    const columns = Object.keys(reportData[0]);

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase"
                >
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reportData.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="py-3 px-4 text-sm text-gray-900">
                    {row[col] !== null && row[col] !== undefined ? row[col] : "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GEM CRM Reports</h1>
          <p className="text-gray-600 mt-1">Analyze bid performance and trends</p>
        </div>
        <button
          onClick={() => handleExport("excel")}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ReportTypeCard
          icon={Calendar}
          title="Date-wise"
          active={reportType === "date-wise"}
          onClick={() => setReportType("date-wise")}
        />
        <ReportTypeCard
          icon={User}
          title="Employee-wise"
          active={reportType === "employee-wise"}
          onClick={() => setReportType("employee-wise")}
        />
        <ReportTypeCard
          icon={Building2}
          title="Organisation-wise"
          active={reportType === "organisation-wise"}
          onClick={() => setReportType("organisation-wise")}
        />
        <ReportTypeCard
          icon={BarChart3}
          title="Platform-wise"
          active={reportType === "platform-wise"}
          onClick={() => setReportType("platform-wise")}
        />
        <ReportTypeCard
          icon={TrendingUp}
          title="Won/Lost"
          active={reportType === "won-lost"}
          onClick={() => setReportType("won-lost")}
        />
        <ReportTypeCard
          icon={DollarSign}
          title="Financial"
          active={reportType === "financial"}
          onClick={() => setReportType("financial")}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Employees</option>
                {assignedEmployees.map((emp) => (
                  <option key={emp.empId} value={emp.empId}>
                    {emp.username || emp.empId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organisation ID
              </label>
              <input
                type="number"
                value={organisationId}
                onChange={(e) => setOrganisationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Organisation ID"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Platforms</option>
                <option value="GEM">GEM</option>
                <option value="E Procurement">E Procurement</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{getReportTitle()}</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          renderTable()
        )}
      </div>
    </div>
  );
}

function ReportTypeCard({ icon: Icon, title, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border-2 transition-all ${
        active
          ? "border-blue-600 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon className={`w-6 h-6 ${active ? "text-blue-600" : "text-gray-400"}`} />
        <span className={`text-sm font-medium ${active ? "text-blue-600" : "text-gray-600"}`}>
          {title}
        </span>
      </div>
    </button>
  );
}
