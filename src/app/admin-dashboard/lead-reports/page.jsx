// app/reports/page.jsx
"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import CustomerTable from "@/components/CustomerTable";
import CustomerCharts from "@/components/CustomerCharts";
import { RefreshCcw } from "lucide-react";
import { toast } from "react-hot-toast";

const campaignList = [
  { value: "india_mart", label: "India Mart" },
  { value: "social_media", label: "Social Media" },
  { value: "google_ads", label: "Google Ads" },
  { value: "visit", label: "Visit" },
  { value: "website_visit", label: "Website Visit" },
  { value: "reference", label: "Reference" },
];
const statusList = ["Very Good", "Average", "Poor", "Denied"];

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    leadCampaign: "all",
    status: "all",
    employeeName: "all",
  });
  const [customers, setCustomers] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chartStats, setChartStats] = useState({ statusStats: [], campaignStats: [], stageStats: [] });
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    currentPage: 1,
    pageSize: 50,
  });

  // Use a single useEffect to handle all data fetching based on URL changes
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      const params = new URLSearchParams(searchParams);

      try {
        const res = await fetch(`/api/customers-data?${params.toString()}`);
        const data = await res.json();

        if (res.ok) {
          setEmployees(data.employees || []);
          setCustomers(data.customers || []);
          setPagination({
            total: data.total || 0,
            totalPages: data.totalPages || 1,
            currentPage: data.currentPage || 1,
            pageSize: data.pageSize || 50,
          });

          if (data.customers && data.customers.length === 0) {
            toast("No data found for the selected filters.");
          }

          const chartRes = await fetch(
            `/api/customers-data?${params.toString()}&mode=charts`
          );
          const chartData = await chartRes.json();

          if (chartRes.ok) {
            setChartStats({
              statusStats: chartData.statusStats || [],
              campaignStats: chartData.campaignStats || [],
              stageStats: chartData.stageStats || [],
            });
          } else {
            setChartStats({ statusStats: [], campaignStats: [], stageStats: [] });
          }
        } else {
          toast.error(data.error || "Failed to fetch data.");
          setCustomers([]);
          setPagination({
            total: 0,
            totalPages: 1,
            currentPage: 1,
            pageSize: 50,
          });
          setChartStats({ statusStats: [], campaignStats: [], stageStats: [] });
        }
      } catch (error) {
        console.error("Failed to load admin lead reports:", error);
        toast.error("Something went wrong while loading lead reports.");
        setCustomers([]);
        setPagination({
          total: 0,
          totalPages: 1,
          currentPage: 1,
          pageSize: 50,
        });
        setChartStats({ statusStats: [], campaignStats: [], stageStats: [] });
      } finally {
        setIsLoading(false);
      }
    };

    // Initialize filters from URL on page load
    setFilters({
      startDate: searchParams.get("startDate") || "",
      endDate: searchParams.get("endDate") || "",
      leadCampaign: searchParams.get("leadCampaign") || "all",
      status: searchParams.get("status") || "all",
      employeeName: searchParams.get("employeeName") || "all",
      stage: searchParams.get("stage") || "all",
    });

    fetchAllData();
  }, [searchParams]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFetchData = () => {
    const newParams = new URLSearchParams();
    Object.keys(filters).forEach((key) => {
      if (filters[key] && filters[key] !== "all") {
        newParams.set(key, filters[key]);
      }
    });
    newParams.set("page", "1");
    router.push(`/admin-dashboard/lead-reports?${newParams.toString()}`);
  };

  const handleReset = () => {
    setFilters({
      startDate: "",
      endDate: "",
      leadCampaign: "all",
      status: "all",
      employeeName: "all",
      stage: "all",
    });
    setCustomers(null);
    setPagination({ total: 0, totalPages: 1, currentPage: 1, pageSize: 50 });
    router.push("/admin-dashboard/lead-reports");
    // toast.success("Filters have been reset.");
  };

  const totalLeads = pagination.total || 0;
  const stageStats = chartStats.stageStats || [];

  const getStageCount = (label) => {
    const row = stageStats.find((s) => s.stage === label);
    return row ? Number(row.count || 0) : 0;
  };

  const newLeads = getStageCount("New");
  const wonLeads = getStageCount("Won (Order Received)");
  const lostLeads = getStageCount("Lost");
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0.0";

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 border-b-2 pb-2">
        Lead Reports
      </h1>

      {/* 📊 Filters and Fetch Button */}
      <div className="bg-gray-50 rounded-xl p-6 shadow-md border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 items-end">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Date From
          </label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Date To
          </label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Lead Campaign
          </label>
          <select
            name="leadCampaign"
            value={filters.leadCampaign}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All</option>
            {campaignList.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Stage
          </label>
          <select
            name="stage"
            value={filters.stage}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Stages</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Interested">Interested</option>
            <option value="Demo Scheduled">Demo Scheduled</option>
            <option value="Demo Completed">Demo Completed</option>
            <option value="Qualified">Qualified</option>
            <option value="Quotation Sent">Quotation Sent</option>
            <option value="Quotation Revised">Quotation Revised</option>
            <option value="Negotiation / Follow-up">Negotiation / Follow-up</option>
            <option value="Decision Pending">Decision Pending</option>
            <option value="Won (Order Received)">Won (Order Received)</option>
            <option value="Lost">Lost</option>
            <option value="Disqualified / Invalid Lead">Disqualified / Invalid Lead</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Status
          </label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All</option>
            {statusList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Employee Name
          </label>
          <select
            name="employeeName"
            value={filters.employeeName}
            onChange={handleFilterChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All</option>
            {employees.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 lg:col-span-1 flex gap-2">
          <button
            onClick={handleFetchData}
            disabled={isLoading}
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Fetching..." : "Fetch Data"}
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition duration-200"
          >
            <RefreshCcw size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Total Leads
          </span>
          <span className="text-2xl font-bold text-gray-900">{totalLeads}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            New Leads
          </span>
          <span className="text-2xl font-bold text-blue-600">{newLeads}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Won
          </span>
          <span className="text-2xl font-bold text-emerald-600">{wonLeads}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Lost
          </span>
          <span className="text-2xl font-bold text-rose-600">{lostLeads}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Conversion Rate
          </span>
          <span className="text-2xl font-bold text-indigo-600">{conversionRate}%</span>
        </div>
      </div>

      {/* 📈 Charts Section */}
      {customers && customers.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <CustomerCharts
            customers={customers}
            statusStats={chartStats.statusStats}
            campaignStats={chartStats.campaignStats}
            stageStats={chartStats.stageStats}
          />
        </div>
      )}

      {/* 📋 Table Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Customer List</h3>
            <span className="text-gray-600 font-semibold">
              Total Records: {pagination.total}
            </span>
          </div>
          <CustomerTable customers={customers} isLoading={isLoading} />
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (pagination.currentPage > 1) {
                      const params = new URLSearchParams(searchParams);
                      params.set("page", String(pagination.currentPage - 1));
                      router.push(`/admin-dashboard/lead-reports?${params.toString()}`);
                    }
                  }}
                  disabled={pagination.currentPage === 1 || isLoading}
                  className="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (pagination.currentPage < pagination.totalPages) {
                      const params = new URLSearchParams(searchParams);
                      params.set("page", String(pagination.currentPage + 1));
                      router.push(`/admin-dashboard/lead-reports?${params.toString()}`);
                    }
                  }}
                  disabled={pagination.currentPage === pagination.totalPages || isLoading}
                  className="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
