"use client";

import { useState, useEffect, useCallback } from "react";
import SummaryBox from "@/components/SummaryBox";
import Modal from "@/components/ModalUser";
import { Search, ArrowLeft } from "lucide-react";
import dayjs from "dayjs";
import Link from "next/link";

export default function AllHrReportPage() {
  const [data, setData] = useState({
    entries: [],
    stats: {
      interviewAttended: 0,
      selectedFromInterview: 0,
      joining: 0,
      totalCalls: 0,
      shortlistedForInterview: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [dateRange, setDateRange] = useState("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [creators, setCreators] = useState([]);
  const [selectedHr, setSelectedHr] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    let startDate, endDate;

    const today = dayjs();
    switch (dateRange) {
      case "today":
        startDate = today.format("YYYY-MM-DD");
        endDate = today.format("YYYY-MM-DD");
        break;
      case "this_week":
        startDate = today.startOf("week").format("YYYY-MM-DD");
        endDate = today.endOf("week").format("YYYY-MM-DD");
        break;
      case "this_month":
        startDate = today.startOf("month").format("YYYY-MM-DD");
        endDate = today.endOf("month").format("YYYY-MM-DD");
        break;
      case "custom":
        startDate = customFromDate;
        endDate = customToDate;
        break;
      default:
        startDate = today.format("YYYY-MM-DD");
        endDate = today.format("YYYY-MM-DD");
    }

    try {
      const params = new URLSearchParams({
        created_from: startDate,
        created_to: endDate,
      });

      if (selectedHr) {
        params.append("created_by", selectedHr);
      }

      const res = await fetch(`/api/empcrm/hiring?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch hiring data");
      }
      const fetchedData = await res.json();
      const entries = fetchedData.entries || [];
      
      if (fetchedData.creators) {
        setCreators(fetchedData.creators);
      }

      const stats = {
        interviewAttended: entries.filter(e => e.status === "Attended Interview").length,
        selectedFromInterview: entries.filter(e => e.status === "Selected").length,
        joining: entries.filter(e => e.status === "Joined" || e.status === "Hired").length,
        totalCalls: entries.length,
        shortlistedForInterview: entries.filter(e => e.status === "Shortlisted for interview").length,
      };

      setData({
        entries,
        stats,
      });
    } catch (error) {
      console.error("Error fetching HR data:", error);
      setData({ entries: [], stats: { interviewAttended: 0, selectedFromInterview: 0, joining: 0, totalCalls: 0, shortlistedForInterview: 0 } });
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, customFromDate, customToDate, selectedHr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBoxClick = (title, records) => {
    setModalTitle(title);
    const formattedRecords = records.map(item => ({
      "Candidate Name": item.candidate_name,
      "Contact": item.emp_contact,
      "Designation": item.designation,
      "Status": item.status,
      "Interview Date": item.interview_at ? dayjs(item.interview_at).format("DD-MMM-YYYY HH:mm") : "—",
    }));
    setModalData(formattedRecords);
    setIsModalOpen(true);
  };

  const tableData = data.entries
    .filter(item => {
      const search = searchTerm.toLowerCase();
      return (
        item.candidate_name?.toLowerCase().includes(search) ||
        item.emp_contact?.toLowerCase().includes(search) ||
        item.designation?.toLowerCase().includes(search) ||
        item.status?.toLowerCase().includes(search)
      );
    })
    .map((item) => ({
      "Candidate Name": item.candidate_name,
      "Contact": item.emp_contact,
      "Designation": item.designation,
      "Status": item.status,
      "Interview Date": item.interview_at ? dayjs(item.interview_at).format("DD-MMM-YYYY HH:mm") : "—",
      "Created By": item.creator_name || item.created_by,
      "Created At": dayjs(item.created_at).format("DD-MMM-YYYY HH:mm"),
    }));

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="flex items-center gap-4 border-b-2 pb-2">
        <Link href="/admin-dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold text-gray-800">
          All HR Report
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Date Range Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange("today")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === "today"
                ? "bg-sky-600 text-white shadow"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRange("this_week")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === "this_week"
                ? "bg-sky-600 text-white shadow"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              This Week
            </button>
            <button
              onClick={() => setDateRange("this_month")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === "this_month"
                ? "bg-sky-600 text-white shadow"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              This Month
            </button>
          </div>
          {/* Custom Date Picker */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto"
            />
            <span className="text-gray-500 hidden sm:block">to</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto"
            />
            <button
              onClick={() => {
                if (customFromDate && customToDate) {
                  setDateRange("custom");
                }
              }}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === "custom"
                ? "bg-sky-600 text-white shadow"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              fetch
            </button>
          </div>
        </div>

        {/* HR Filter */}
        {creators.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filter by HR:</span>
            <select
              value={selectedHr}
              onChange={(e) => setSelectedHr(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-sky-500 focus:border-sky-500 min-w-[150px]"
            >
              <option value="">All HRs</option>
              {creators.map((hr) => (
                <option key={hr.username} value={hr.username}>
                  {hr.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <SummaryBox
          title="Interview Attended"
          count={data.stats.interviewAttended}
          isLoading={isLoading}
          onClick={() => handleBoxClick("Interview Attended", data.entries.filter(e => e.status === "Attended Interview"))}
        />
        <SummaryBox
          title="Selected from Interview"
          count={data.stats.selectedFromInterview}
          isLoading={isLoading}
          onClick={() => handleBoxClick("Selected from Interview", data.entries.filter(e => e.status === "Selected"))}
        />
        <SummaryBox
          title="Joining"
          count={data.stats.joining}
          isLoading={isLoading}
          onClick={() => handleBoxClick("Joining", data.entries.filter(e => e.status === "Joined" || e.status === "Hired"))}
        />
        <SummaryBox
          title="Total Calls"
          count={data.stats.totalCalls}
          isLoading={isLoading}
          onClick={() => handleBoxClick("Total Calls", data.entries)}
        />
        <SummaryBox
          title="Shortlisted for Interview"
          count={data.stats.shortlistedForInterview}
          isLoading={isLoading}
          onClick={() => handleBoxClick("Shortlisted for Interview", data.entries.filter(e => e.status === "Shortlisted for interview"))}
        />
      </div>

      {/* Total Calls Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Total Calls Details</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search calls..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-sky-500 focus:border-sky-500 w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold border-b">Candidate Name</th>
                <th className="px-6 py-4 font-semibold border-b">Contact</th>
                <th className="px-6 py-4 font-semibold border-b">Designation</th>
                <th className="px-6 py-4 font-semibold border-b">Status</th>
                <th className="px-6 py-4 font-semibold border-b">Interview Date</th>
                <th className="px-6 py-4 font-semibold border-b">HR Name</th>
                <th className="px-6 py-4 font-semibold border-b">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                    ))}
                  </tr>
                ))
              ) : tableData.length > 0 ? (
                tableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-sky-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">{row["Candidate Name"]}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row["Contact"]}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row["Designation"]}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                       <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                         row.Status === "Selected" ? "bg-green-100 text-green-800" :
                         row.Status === "Rejected" ? "bg-red-100 text-red-800" :
                         "bg-blue-100 text-blue-800"
                       }`}>
                         {row.Status}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row["Interview Date"]}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row["Created By"]}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row["Created At"]}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    No calls found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        data={modalData}
      />
    </div>
  );
}
