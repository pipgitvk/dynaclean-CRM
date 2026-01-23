"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Edit, Eye, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";

export default function TLCustomersTable({
  customers,
  allCustomersForKPI = [],
  employees,
  searchParams,
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  pageSize = 50,
  isAdmin = false,
  tlOnly = true,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState(searchParams?.search || "");
  const [selectedEmployee, setSelectedEmployee] = useState(
    searchParams?.employee || "",
  );
  const [selectedStatus, setSelectedStatus] = useState(
    searchParams?.status || "",
  );
  const [selectedStage, setSelectedStage] = useState(searchParams?.stage || "");
  const [selectedTag, setSelectedTag] = useState(searchParams?.tag || "");
  const [fromDate, setFromDate] = useState(searchParams?.fromDate || "");
  const [toDate, setToDate] = useState(searchParams?.toDate || "");
  const [nextFromDate, setNextFromDate] = useState(
    searchParams?.nextFromDate || "",
  );
  const [nextToDate, setNextToDate] = useState(searchParams?.nextToDate || "");
  const [assigningLead, setAssigningLead] = useState(null);
  const [selectedEmpForAssign, setSelectedEmpForAssign] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const TAGS = [
    "Demo",
    "Payment Collection",
    "Truck FollowUp",
    "Strong FollowUp",
    "Service Issue",
    "Prime",
    "Repeat order",
    "Mail",
    "Running Orders",
    "Clear",
  ];

  const basePath = isAdmin
    ? "/admin-dashboard/tl-customers"
    : "/user-dashboard/tl-customers";

  // Use allCustomersForKPI for counts, or fallback to customers if not provided
  const customersForKPI =
    allCustomersForKPI.length > 0 ? allCustomersForKPI : customers;
  const getFilteredCustomers = () => {
    const now = dayjs();

    switch (activeFilter) {
      case "upcoming":
        return customers.filter((customer) => {
          const nextFollowup =
            customer.tl_next_followup || customer.latest_next_followup;
          if (!nextFollowup) return false;
          const followupTime = dayjs(nextFollowup);
          const hoursDiff = followupTime.diff(now, "hour");
          return hoursDiff > 0 && hoursDiff <= 3; // Within next 3 hours
        });
      case "due":
        return customers.filter((customer) => {
          // Exclude closed stages
          const excludedStages = [
            "Won (Order Received)",
            "Lost",
            "Disqualified / Invalid Lead",
          ];
          if (excludedStages.includes(customer.stage)) return false;

          const nextFollowup =
            customer.tl_next_followup || customer.latest_next_followup;
          if (!nextFollowup) return false;
          const followupTime = dayjs(nextFollowup);
          return followupTime.isBefore(now); // Overdue
        });
      case "prime":
        return customers.filter(
          (customer) =>
            customer.multi_tag &&
            customer.multi_tag.toLowerCase().includes("prime"),
        );
      default:
        return customers;
    }
  };

  // Get counts for each filter using KPI data (all customers)
  const getFilterCounts = () => {
    const now = dayjs();
    const total = customersForKPI.length;
    const upcoming = customersForKPI.filter((customer) => {
      const nextFollowup =
        customer.tl_next_followup || customer.latest_next_followup;
      if (!nextFollowup) return false;
      const followupTime = dayjs(nextFollowup);
      const hoursDiff = followupTime.diff(now, "hour");
      return hoursDiff > 0 && hoursDiff <= 3;
    }).length;
    const due = customersForKPI.filter((customer) => {
      // Exclude closed stages
      const excludedStages = [
        "Won (Order Received)",
        "Lost",
        "Disqualified / Invalid Lead",
      ];
      if (excludedStages.includes(customer.stage)) return false;

      const nextFollowup =
        customer.tl_next_followup || customer.latest_next_followup;
      if (!nextFollowup) return false;
      const followupTime = dayjs(nextFollowup);
      return followupTime.isBefore(now);
    }).length;
    const prime = customersForKPI.filter(
      (customer) =>
        customer.multi_tag &&
        customer.multi_tag.toLowerCase().includes("prime"),
    ).length;

    return { total, upcoming, due, prime };
  };

  // Get counts for tags
  const getTagCounts = () => {
    const tagCounts = {};
    TAGS.forEach((tag) => {
      tagCounts[tag] = customersForKPI.filter((customer) => {
        if (!customer.multi_tag) return tag === "Clear";
        return customer.multi_tag
          .split(", ")
          .map((t) => t.trim())
          .includes(tag);
      }).length;
    });
    return tagCounts;
  };

  // Get counts for statuses
  const getStatusCounts = () => {
    const statuses = ["New", "Good", "Very Good", "Average", "Poor", "Denied"];
    const statusCounts = {};
    statuses.forEach((status) => {
      statusCounts[status] = customersForKPI.filter(
        (customer) => customer.status === status,
      ).length;
    });
    return statusCounts;
  };

  // Get counts for stages
  const getStageCounts = () => {
    const stages = [
      "New",
      "Contacted",
      "Interested",
      "Demo Scheduled",
      "Demo Completed",
      "without GST order",
      "Qualified",
      "Quotation Sent",
      "Quotation Revised",
      "Negotiation / Follow-up",
      "Decision Pending",
      "Won (Order Received)",
      "Lost",
      "Disqualified / Invalid Lead",
    ];
    const stageCounts = {};
    stages.forEach((stage) => {
      stageCounts[stage] = customersForKPI.filter(
        (customer) => customer.stage === stage,
      ).length;
    });
    return stageCounts;
  };

  const handleFilterClick = (filter) => {
    setActiveFilter(filter);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedEmployee) params.set("employee", selectedEmployee);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedStage) params.set("stage", selectedStage);
      if (selectedTag) params.set("tag", selectedTag);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (nextFromDate) params.set("nextFromDate", nextFromDate);
      if (nextToDate) params.set("nextToDate", nextToDate);
      router.push(`${basePath}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    startTransition(() => {
      setSearchTerm("");
      setSelectedEmployee("");
      setSelectedStatus("");
      setSelectedStage("");
      setSelectedTag("");
      setFromDate("");
      setToDate("");
      setNextFromDate("");
      setNextToDate("");
      router.push(basePath);
    });
  };

  const handlePageChange = (newPage) => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedEmployee) params.set("employee", selectedEmployee);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedStage) params.set("stage", selectedStage);
      if (selectedTag) params.set("tag", selectedTag);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (nextFromDate) params.set("nextFromDate", nextFromDate);
      if (nextToDate) params.set("nextToDate", nextToDate);

      params.set("page", newPage.toString());
      router.push(`${basePath}?${params.toString()}`);
    });
  };

  const handleAssignLead = async (customerId) => {
    if (!selectedEmpForAssign) {
      alert("Please select an employee");
      return;
    }

    try {
      const response = await fetch("/api/tl-assign-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          employee_username: selectedEmpForAssign,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Lead assigned successfully");
        setAssigningLead(null);
        router.refresh();
      } else {
        alert(data.error || "Failed to assign lead");
      }
    } catch (error) {
      console.error("Error assigning lead:", error);
      alert("Failed to assign lead");
    }
  };

  const getQualityScoreColor = (score) => {
    if (!score) return "bg-gray-200";
    if (score >= 8) return "bg-green-500 text-white";
    if (score >= 5) return "bg-yellow-500 text-white";
    return "bg-red-500 text-white";
  };

  // Stage configuration for progress bar
  const stageConfig = {
    New: { progress: 0, color: "bg-blue-500", label: "New" },
    Contacted: { progress: 10, color: "bg-blue-500", label: "Contacted" },
    Interested: { progress: 20, color: "bg-orange-500", label: "Interested" },
    "Demo Scheduled": {
      progress: 30,
      color: "bg-orange-500",
      label: "Demo Scheduled",
    },
    "Demo Completed": {
      progress: 40,
      color: "bg-orange-500",
      label: "Demo Completed",
    },
    Qualified: { progress: 50, color: "bg-green-400", label: "Qualified" },
    "Quotation Sent": {
      progress: 60,
      color: "bg-sky-500",
      label: "Quotation Sent",
    },
    "Quotation Revised": {
      progress: 70,
      color: "bg-sky-500",
      label: "Quotation Revised",
    },
    "Negotiation / Follow-up": {
      progress: 80,
      color: "bg-pink-500",
      label: "Negotiation",
    },
    "Decision Pending": {
      progress: 85,
      color: "bg-pink-500",
      label: "Decision Pending",
    },
    "Won (Order Received)": {
      progress: 100,
      color: "bg-green-500",
      label: "Won",
    },
    Lost: { progress: 100, color: "bg-gray-500", label: "Lost" },
    "Disqualified / Invalid Lead": {
      progress: 100,
      color: "bg-gray-500",
      label: "Disqualified",
    },
  };

  const getStageInfo = (stage) => {
    return (
      stageConfig[stage] || {
        progress: 0,
        color: "bg-gray-400",
        label: stage || "New",
      }
    );
  };

  const renderStageProgress = (stage) => {
    const stageInfo = getStageInfo(stage);
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">
            {stageInfo.label}
          </span>
          <span className="text-xs text-gray-500">{stageInfo.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${stageInfo.color}`}
            style={{ width: `${stageInfo.progress}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Search and Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between gap-6">
          {/* Left side - Search filters */}
          <div className="flex-1">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                {/* Search */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search (ID, Phone, Name, Company)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search customers..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Search
                      className="absolute left-3 top-2.5 text-gray-400"
                      size={20}
                    />
                  </div>
                </div>

                {/* Employee */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee
                  </label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Employees</option>
                    {employees.map((emp) => (
                      <option key={emp.username} value={emp.username}>
                        {emp.name || emp.username}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      const status = e.target.value;
                      setSelectedStatus(status);
                      startTransition(() => {
                        const params = new URLSearchParams();
                        if (searchTerm) params.set("search", searchTerm);
                        if (selectedEmployee)
                          params.set("employee", selectedEmployee);
                        if (status) params.set("status", status);
                        if (selectedStage) params.set("stage", selectedStage);
                        if (selectedTag) params.set("tag", selectedTag);
                        if (fromDate) params.set("fromDate", fromDate);
                        if (toDate) params.set("toDate", toDate);
                        if (nextFromDate)
                          params.set("nextFromDate", nextFromDate);
                        if (nextToDate) params.set("nextToDate", nextToDate);
                        router.push(`${basePath}?${params.toString()}`);
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    {[
                      "New",
                      "Good",
                      "Very Good",
                      "Average",
                      "Poor",
                      "Denied",
                    ].map((s) => {
                      const statusCounts = getStatusCounts();
                      return (
                        <option key={s} value={s}>
                          {s} ({statusCounts[s] || 0})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Stage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stage
                  </label>
                  <select
                    value={selectedStage}
                    onChange={(e) => {
                      const stage = e.target.value;
                      setSelectedStage(stage);
                      startTransition(() => {
                        const params = new URLSearchParams();
                        if (searchTerm) params.set("search", searchTerm);
                        if (selectedEmployee)
                          params.set("employee", selectedEmployee);
                        if (selectedStatus)
                          params.set("status", selectedStatus);
                        if (stage) params.set("stage", stage);
                        if (selectedTag) params.set("tag", selectedTag);
                        if (fromDate) params.set("fromDate", fromDate);
                        if (toDate) params.set("toDate", toDate);
                        if (nextFromDate)
                          params.set("nextFromDate", nextFromDate);
                        if (nextToDate) params.set("nextToDate", nextToDate);
                        router.push(`${basePath}?${params.toString()}`);
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Stages</option>
                    {[
                      "New",
                      "Contacted",
                      "Interested",
                      "Demo Scheduled",
                      "Demo Completed",
                      "without GST order",
                      "Qualified",
                      "Quotation Sent",
                      "Quotation Revised",
                      "Negotiation / Follow-up",
                      "Decision Pending",
                      "Won (Order Received)",
                      "Lost",
                      "Disqualified / Invalid Lead",
                    ].map((s) => {
                      const stageCounts = getStageCounts();
                      return (
                        <option key={s} value={s}>
                          {s} ({stageCounts[s] || 0})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Tag */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tag
                  </label>
                  <select
                    value={selectedTag}
                    onChange={(e) => {
                      const tag = e.target.value;
                      setSelectedTag(tag);
                      startTransition(() => {
                        const params = new URLSearchParams();
                        if (searchTerm) params.set("search", searchTerm);
                        if (selectedEmployee)
                          params.set("employee", selectedEmployee);
                        if (selectedStatus)
                          params.set("status", selectedStatus);
                        if (selectedStage) params.set("stage", selectedStage);
                        if (tag) params.set("tag", tag);
                        if (fromDate) params.set("fromDate", fromDate);
                        if (toDate) params.set("toDate", toDate);
                        if (nextFromDate)
                          params.set("nextFromDate", nextFromDate);
                        if (nextToDate) params.set("nextToDate", nextToDate);
                        router.push(`${basePath}?${params.toString()}`);
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Tags</option>
                    {TAGS.map((tag) => {
                      const tagCounts = getTagCounts();
                      return (
                        <option key={tag} value={tag}>
                          {tag} ({tagCounts[tag] || 0})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Follow-up Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Follow-up From
                  </label>
                  <input
                    type="date"
                    placeholder="Follow-up date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Follow-up Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Follow-up To
                  </label>
                  <input
                    type="date"
                    placeholder="Follow-up date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Next Follow-up From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Follow-up From
                  </label>
                  <input
                    type="date"
                    placeholder="dd/mm/yyyy"
                    value={nextFromDate}
                    onChange={(e) => setNextFromDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Next Follow-up To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Follow-up To
                  </label>
                  <input
                    type="date"
                    placeholder="dd/mm/yyyy"
                    value={nextToDate}
                    onChange={(e) => setNextToDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  {isPending ? "Searching..." : "Search"}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isPending}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <RefreshCw size={18} />
                  )}
                  Reset
                </button>

                {/* TL Only Toggle */}
                <div className="ml-4 flex items-center gap-2 border-l pl-4">
                  <label className="text-sm font-medium text-gray-700">
                    Show TL Entries Only:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      startTransition(() => {
                        const params = new URLSearchParams();
                        if (searchTerm) params.set("search", searchTerm);
                        if (selectedEmployee)
                          params.set("employee", selectedEmployee);
                        if (selectedStatus)
                          params.set("status", selectedStatus);
                        if (selectedStage) params.set("stage", selectedStage);
                        if (selectedTag) params.set("tag", selectedTag);
                        if (fromDate) params.set("fromDate", fromDate);
                        if (toDate) params.set("toDate", toDate);
                        if (nextFromDate)
                          params.set("nextFromDate", nextFromDate);
                        if (nextToDate) params.set("nextToDate", nextToDate);
                        params.set("tlOnly", tlOnly ? "false" : "true");
                        router.push(`${basePath}?${params.toString()}`);
                      });
                    }}
                    disabled={isPending}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      tlOnly ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tlOnly ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-xs font-semibold ${
                      tlOnly ? "text-blue-600" : "text-gray-500"
                    }`}
                  >
                    {tlOnly ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
            </form>
          </div>

          {/* Right side - Filter indicators */}
          <div className="flex items-center gap-4">
            {/* Total/All Filter */}
            <div
              onClick={() => handleFilterClick("all")}
              className={`flex flex-col items-center cursor-pointer transition-all duration-200 ${
                activeFilter === "all" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                  activeFilter === "all"
                    ? "bg-blue-600 ring-2 ring-blue-200"
                    : "bg-gray-400 hover:bg-gray-500"
                }`}
              >
                {getFilterCounts().total}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  activeFilter === "all" ? "text-blue-600" : "text-gray-600"
                }`}
              >
                All
              </span>
            </div>

            {/* Upcoming Filter */}
            <div
              onClick={() => handleFilterClick("upcoming")}
              className={`flex flex-col items-center cursor-pointer transition-all duration-200 ${
                activeFilter === "upcoming" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                  activeFilter === "upcoming"
                    ? "bg-green-600 ring-2 ring-green-200"
                    : "bg-gray-400 hover:bg-gray-500"
                }`}
              >
                {getFilterCounts().upcoming}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  activeFilter === "upcoming"
                    ? "text-green-600"
                    : "text-gray-600"
                }`}
              >
                Up
              </span>
            </div>

            {/* Due/Overdue Filter */}
            <div
              onClick={() => handleFilterClick("due")}
              className={`flex flex-col items-center cursor-pointer transition-all duration-200 ${
                activeFilter === "due" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                  activeFilter === "due"
                    ? "bg-red-600 ring-2 ring-red-200"
                    : "bg-gray-400 hover:bg-gray-500"
                }`}
              >
                {getFilterCounts().due}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  activeFilter === "due" ? "text-red-600" : "text-gray-600"
                }`}
              >
                Due
              </span>
            </div>

            {/* Prime Filter */}
            <div
              onClick={() => handleFilterClick("prime")}
              className={`flex flex-col items-center cursor-pointer transition-all duration-200 ${
                activeFilter === "prime" ? "scale-110" : "hover:scale-105"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ${
                  activeFilter === "prime"
                    ? "bg-purple-600 ring-2 ring-purple-200"
                    : "bg-gray-400 hover:bg-gray-500"
                }`}
              >
                {getFilterCounts().prime}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  activeFilter === "prime" ? "text-purple-600" : "text-gray-600"
                }`}
              >
                Prime
              </span>
            </div>
          </div>
        </div>

        {/* Filter Description */}
        <div className="text-center mt-3">
          <p className="text-xs text-gray-500">
            {activeFilter === "all" && "Showing all customers"}
            {activeFilter === "upcoming" && "Follow-up within 3 hours"}
            {activeFilter === "due" && "Overdue follow-ups"}
            {activeFilter === "prime" && "Prime customers"}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto relative">
        {isPending && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={40} className="animate-spin text-blue-600" />
              <p className="text-sm text-gray-600 font-medium">Loading...</p>
            </div>
          </div>
        )}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Customer ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Name / Company / Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Stage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                TL Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Multi Tag
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Next Followup
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Date Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {getFilteredCustomers().length === 0 ? (
              <tr>
                <td
                  colSpan="10"
                  className="px-6 py-4 text-center text-gray-500"
                >
                  {activeFilter === "all"
                    ? "No customers found"
                    : `No customers found for "${activeFilter}" filter`}
                </td>
              </tr>
            ) : (
              getFilteredCustomers().map((customer) => (
                <tr key={customer.customer_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {customer.customer_id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 break-words max-w-xs">
                      {customer.first_name} {customer.last_name}
                    </div>
                    <div className="text-sm text-gray-500 break-words max-w-xs">
                      {customer.company}
                    </div>
                    <div className="text-sm text-gray-700 break-words max-w-xs mt-1">
                      {customer.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {customer.lead_source || "Unassigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-24">
                      {renderStageProgress(customer.stage)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {customer.lead_quality_score ? (
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getQualityScoreColor(
                          customer.lead_quality_score,
                        )}`}
                      >
                        {customer.lead_quality_score}/10
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex flex-wrap gap-1">
                      {customer.multi_tag &&
                        customer.multi_tag.split(", ").map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      {!customer.multi_tag && (
                        <span className="text-gray-400 text-xs">No tags</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {customer.tl_next_followup
                      ? dayjs(customer.tl_next_followup).format(
                          "DD MMM, YYYY HH:mm",
                        )
                      : customer.latest_next_followup
                        ? dayjs(customer.latest_next_followup).format(
                            "DD MMM, YYYY HH:mm",
                          )
                        : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {customer.date_created
                      ? dayjs(customer.date_created).format(
                          "DD MMM, YYYY HH:mm",
                        )
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Link
                        href={`${basePath}/${customer.customer_id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </Link>
                      <Link
                        href={`${basePath}/${customer.customer_id}/followup`}
                        className="text-green-600 hover:text-green-800"
                        title="Add TL Followup"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => setAssigningLead(customer.customer_id)}
                        className="text-purple-600 hover:text-purple-800"
                        title="Assign/Reassign Lead"
                      >
                        <UserPlus size={18} />
                      </button>
                    </div>

                    {/* Assign Modal */}
                    {assigningLead === customer.customer_id && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                          <h3 className="text-lg font-semibold mb-4">
                            Assign Lead
                          </h3>
                          <select
                            value={selectedEmpForAssign}
                            onChange={(e) =>
                              setSelectedEmpForAssign(e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
                          >
                            <option value="">Select Employee</option>
                            {employees.map((emp) => (
                              <option key={emp.username} value={emp.username}>
                                {emp.name || emp.username}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleAssignLead(customer.customer_id)
                              }
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => {
                                setAssigningLead(null);
                                setSelectedEmpForAssign("");
                              }}
                              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <p>
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}{" "}
              customers
            </p>
            {activeFilter !== "all" && (
              <p className="text-xs text-gray-500 mt-1">
                Filtered on page: {getFilteredCustomers().length} customers
              </p>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
              className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {/* First page */}
              {currentPage > 3 && (
                <>
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={isPending}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    1
                  </button>
                  {currentPage > 4 && (
                    <span className="px-2 text-gray-500">...</span>
                  )}
                </>
              )}

              {/* Page numbers around current page */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return (
                    page === currentPage ||
                    page === currentPage - 1 ||
                    page === currentPage + 1 ||
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  );
                })
                .map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    disabled={isPending}
                    className={`px-3 py-1 border rounded-md text-sm font-medium ${
                      page === currentPage
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

              {/* Last page */}
              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && (
                    <span className="px-2 text-gray-500">...</span>
                  )}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={isPending}
                    className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
              className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
