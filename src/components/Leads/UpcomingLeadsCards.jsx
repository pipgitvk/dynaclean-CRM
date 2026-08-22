"use client";
import { useEffect, useState } from "react";
import TaskCard from "./TaskCard";
import { getGradientColor } from "@/utils/getGradientColor";
import {
  formatCrmDatetimeForISTDisplay,
  getCrmInstantMs,
} from "@/lib/timezone";

function SkeletonCard() {
  return (
    <div className="w-[300px] h-32 bg-gray-200 animate-pulse rounded-xl shadow flex-shrink-0" />
  );
}

export default function UpcomingLeadsCards({
  leadSource,
  userRole = "",
  compact = false,
  variant = "default",
  dashboardPrefix = "/user-dashboard",
}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState("soonest"); // soonest | latest | name
  const [startDate, setStartDate] = useState(() => {
    // Try to get from localStorage first, otherwise default to current date
    if (typeof window !== 'undefined') {
      const savedStartDate = localStorage.getItem('upcomingLeads_startDate');
      if (savedStartDate) return savedStartDate;
    }
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    // Try to get from localStorage first, otherwise default to current date
    if (typeof window !== 'undefined') {
      const savedEndDate = localStorage.getItem('upcomingLeads_endDate');
      if (savedEndDate) return savedEndDate;
    }
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL or specific status
  const [stageFilter, setStageFilter] = useState("ALL"); // ALL or specific stage
  const [multiTagFilter, setMultiTagFilter] = useState("ALL"); // ALL or specific multi-tag
  const [tagFilter, setTagFilter] = useState(""); // empty or specific tag
  const isServiceSupport = userRole === "SERVICE SUPPORT";

  // Functions to handle date changes and save to localStorage
  const handleStartDateChange = (newDate) => {
    setStartDate(newDate);
    if (typeof window !== 'undefined') {
      localStorage.setItem('upcomingLeads_startDate', newDate);
    }
  };

  const handleEndDateChange = (newDate) => {
    setEndDate(newDate);
    if (typeof window !== 'undefined') {
      localStorage.setItem('upcomingLeads_endDate', newDate);
    }
  };

  const resetToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    if (typeof window !== 'undefined') {
      localStorage.setItem('upcomingLeads_startDate', today);
      localStorage.setItem('upcomingLeads_endDate', today);
    }
  };

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        let url = `/api/upcoming-leads?leadSource=${leadSource}`;
        
        // Add date parameters if they are set
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        
        const res = await fetch(url);
        const data = await res.json();
        setLeads(data.leads || []);
        console.log("Fetched leads:", data.leads);
      } catch (err) {
        console.error("Failed to fetch leads", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeads();
  }, [leadSource, startDate, endDate]);

  // Prepare filtered and sorted leads
  const processedLeads = (() => {
    let filtered = [...leads];

    // Exclude invalid statuses (like 'Invalid', 'Disqualified', 'Denied')
    const invalidStatuses = ["invalid", "disqualified", "denied"];
    filtered = filtered.filter((c) => {
      const statusLower = (c.status || "").trim().toLowerCase();
      return !invalidStatuses.includes(statusLower);
    });

    // For SERVICE SUPPORT, only show leads with service_next_followup set
    if (isServiceSupport) {
      filtered = filtered.filter((cust) => cust.service_next_followup);
    }

    // Status filtering
    if (statusFilter && statusFilter !== "ALL") {
      const wanted = String(statusFilter).toLowerCase();
      filtered = filtered.filter((cust) =>
        String(cust.status || "").toLowerCase() === wanted
      );
    }

    // Stage filtering
    if (stageFilter && stageFilter !== "ALL") {
      const wantedStage = String(stageFilter).toLowerCase();
      filtered = filtered.filter((cust) =>
        String(cust.stage || "").toLowerCase() === wantedStage
      );
    }

    // Multi-tag filtering
    if (multiTagFilter && multiTagFilter !== "ALL") {
      filtered = filtered.filter((cust) => {
        const tags = String(cust.multi_tag || "").split(",").map(t => t.trim());
        return tags.some(t => t === multiTagFilter);
      });
    }

    // Tag filtering
    if (tagFilter && tagFilter !== "") {
      filtered = filtered.filter((cust) => {
        return cust.tags === tagFilter;
      });
    }

    // Date filtering (now handled by API, so remove frontend filtering)
    // if (startDate || endDate) {
    //   const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    //   const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    //   const dateField = isServiceSupport ? "service_next_followup" : "next_followup_date";
    //   filtered = filtered.filter((cust) => {
    //     if (!cust[dateField]) return false; // hide if no date when filter applied
    //     const ms = getCrmInstantMs(cust[dateField]);
    //     if (!ms) return false;
    //     const d = new Date(ms);
    //     if (start && d < start) return false;
    //     if (end && d > end) return false;
    //     return true;
    //   });
    // }

    // Sorting
    filtered.sort((a, b) => {
      if (sortOrder === "name") {
        return (a.first_name || "").localeCompare(b.first_name || "");
      }
      const dateField = isServiceSupport ? "service_next_followup" : "next_followup_date";
      const aTime = a[dateField]
        ? getCrmInstantMs(a[dateField])
        : Infinity;
      const bTime = b[dateField]
        ? getCrmInstantMs(b[dateField])
        : Infinity;
      if (sortOrder === "latest") return bTime - aTime; // latest first
      return aTime - bTime; // default soonest first
    });

    return filtered;
  })();

  const isSales = variant === "sales";
  const shellClass = compact || isSales
    ? ""
    : "bg-white lg:p-6 rounded-xl shadow-md mx-auto mt-2";
  const controlClass = isSales
    ? "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-200"
    : compact
      ? "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-200"
      : "rounded-md border px-3 py-2 text-sm";
  const scrollClass = isSales
    ? "hide-scrollbar w-full overflow-x-auto py-2"
    : compact
      ? "w-full overflow-x-auto py-3 hide-scrollbar"
      : "w-full md:w-[77vw] lg:w-[71vw] overflow-x-scroll py-5 hide-scrollbar";

  return (
    <div className={shellClass}>
      <div className={`mb-4 flex flex-col gap-3 ${isSales ? "" : "lg:flex-row lg:items-end lg:justify-between"}`}>
        <p className={`${isSales ? "text-xs" : "text-sm"} text-slate-500`}>
          Showing {processedLeads.length} of {leads.length} leads
        </p>
        <div className={`flex flex-wrap items-end gap-2 ${isSales ? "md:gap-2" : "gap-3"}`}>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">Status</label>
            <select
              className={controlClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {[...new Set(leads.map((l) => l.status).filter(Boolean))]
                .sort((a, b) => String(a).localeCompare(String(b)))
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">Stage</label>
            <select
              className={controlClass}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="ALL">All stages</option>
              {[...new Set(leads.map((l) => l.stage).filter(Boolean))]
                .sort((a, b) => String(a).localeCompare(String(b)))
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">All Multi-tag</label>
            <select
              className={controlClass}
              value={multiTagFilter}
              onChange={(e) => setMultiTagFilter(e.target.value)}
            >
              <option value="ALL">All Multi-tags</option>
              {[...new Set(
                leads
                  .flatMap((l) => String(l.multi_tag || "").split(",").map(t => t.trim()))
                  .filter(Boolean)
              )]
                .sort((a, b) => String(a).localeCompare(String(b)))
                .map((mt) => (
                  <option key={mt} value={mt}>
                    {mt}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">All Tags</label>
            <select
              className={controlClass}
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">All Tags</option>
              <option value="Facilities Management Company">Facilities Management Company</option>
              <option value="Industrial Facilities">Industrial Facilities</option>
              <option value="Commercial Buildings">Commercial Buildings</option>
              <option value="Healthcare Facilities">Healthcare Facilities</option>
              <option value="Educational Institutions">Educational Institutions</option>
              <option value="Government Facilities">Government Facilities</option>
              <option value="Property Management Companies">Property Management Companies</option>
              <option value="Construction Company">Construction Company</option>
              <option value="Transportation Companies">Transportation Companies</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">Sort by</label>
            <select
              className={controlClass}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="soonest">Due date: Soonest first</option>
              <option value="latest">Due date: Latest first</option>
              <option value="name">Customer name (A-Z)</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">Start date</label>
            <input
              type="date"
              className={controlClass}
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-slate-500">End date</label>
            <input
              type="date"
              className={controlClass}
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
            />
          </div>
          {(startDate !== new Date().toISOString().split('T')[0] || endDate !== new Date().toISOString().split('T')[0]) && (
            <button
              className="border rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={resetToToday}
            >
              Reset to today
            </button>
          )}
        </div>
      </div>

      <div className={scrollClass}>
        <div className="flex min-w-max flex-row flex-nowrap gap-3">
          {loading ? (
            [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
          ) : processedLeads.length > 0 ? (
            processedLeads.map((cust) => {
              const dateField = isServiceSupport ? "service_next_followup" : "next_followup_date";
              const hours = cust[dateField]
                ? (getCrmInstantMs(cust[dateField]) - Date.now()) / 3600000
                : null;
              const bgColor = cust[dateField]
                ? getGradientColor(hours)
                : "rgb(255, 165, 0)";
              return (
                <div key={cust.customer_id} className="flex-shrink-0">
                  <TaskCard
                    customerId={cust.customer_id}
                    name={cust.first_name}
                    contact={cust.phone}
                    company={cust.company}
                    products_interest={cust.products_interest}
                    stage={cust.stage}
                    dueDate={
                      cust[dateField]
                        ? formatCrmDatetimeForISTDisplay(cust[dateField])
                        : "Not set"
                    }
                    notes={cust.notes}
                    status={cust.status}
                    bgColor={bgColor}
                    dashboardPrefix={dashboardPrefix}
                    variant={isSales ? "sales" : "default"}
                  />
                </div>
              );
            })
          ) : (
            <div className="text-center w-full text-gray-500">
              No upcoming leads found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
