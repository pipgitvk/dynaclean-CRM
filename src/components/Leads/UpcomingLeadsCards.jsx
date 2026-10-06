"use client";
import TypeableDateFilterInput from "@/components/ui/TypeableDateFilterInput";
import React, { useEffect, useState } from "react";
import TaskCard from "./TaskCard";
import { getGradientColor } from "@/utils/getGradientColor";
import { formatCrmDatetimeForISTDisplay, getCrmInstantMs } from "@/lib/timezone";
import {
  applyUpcomingLeadsClientFilters,
  defaultUpcomingLeadsFilters,
} from "@/utils/applyUpcomingLeadsClientFilters";

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
  const isServiceSupport = userRole === "SERVICE SUPPORT";

  // UI state (what user selects but not yet applied)
  const [sortOrder, setSortOrder] = useState("soonest");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [multiTagFilter, setMultiTagFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("");

  // Applied state (what was last fetched with)
  const [appliedFilters, setAppliedFilters] = useState({
    sortOrder: "soonest",
    startDate: "",
    endDate: new Date().toISOString().split('T')[0],
    statusFilter: "ALL",
    stageFilter: "ALL",
    multiTagFilter: "ALL",
    tagFilter: "",
  });

  async function fetchLeads(filters = appliedFilters) {
    setLoading(true);
    try {
      let url = `/api/upcoming-leads?leadSource=${leadSource}&userRole=${userRole}`;
      if (filters.startDate) url += `&startDate=${filters.startDate}`;
      if (filters.endDate) url += `&endDate=${filters.endDate}`;
      const res = await fetch(url);
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err) {
      console.error("Failed to fetch leads", err);
    } finally {
      setLoading(false);
    }
  }

  const notifyTableFilters = (filters) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("upcomingLeads_startDate", filters.startDate);
    localStorage.setItem("upcomingLeads_endDate", filters.endDate);
    window.dispatchEvent(
      new CustomEvent("upcomingLeadsFilterChanged", { detail: filters })
    );
  };

  // Initial load
  useEffect(() => {
    const initFilters = defaultUpcomingLeadsFilters();
    setAppliedFilters(initFilters);
    fetchLeads(initFilters);
    setTimeout(() => notifyTableFilters(initFilters), 0);
  }, [leadSource, userRole]);

  const handleFetch = () => {
    const newFilters = { sortOrder, startDate, endDate, statusFilter, stageFilter, multiTagFilter, tagFilter };
    setAppliedFilters(newFilters);
    fetchLeads(newFilters);
    notifyTableFilters(newFilters);
  };

  const processedLeads = applyUpcomingLeadsClientFilters(
    leads,
    appliedFilters,
    isServiceSupport
  );

  const isSales = variant === "sales";
  const shellClass = compact || isSales ? "" : "";
  const controlClass = isSales
    ? "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-200"
    : "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-300";

  const scrollRef = React.useRef(null);
  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
    }
  };

  return (
    <div className={shellClass}>
      {/* ── Filter bar ── */}
      <div className="mb-3 flex flex-col gap-2">

        {/* Row 1: Status, Stage, Multi-tag, Tags, Sort */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label className="mb-0.5 text-xs text-slate-500">Status</label>
            <select className={controlClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              {[...new Set(leads.map((l) => l.status).filter(Boolean))].sort().map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-0.5 text-xs text-slate-500">Stage</label>
            <select className={controlClass} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="ALL">All stages</option>
              {[...new Set(leads.map((l) => l.stage).filter(Boolean))].sort().map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-0.5 text-xs text-slate-500">All Multi-tag</label>
            <select className={controlClass} value={multiTagFilter} onChange={(e) => setMultiTagFilter(e.target.value)}>
              <option value="ALL">All Multi-tags</option>
              {[...new Set(leads.flatMap((l) => String(l.multi_tag || "").split(",").map(t => t.trim())).filter(Boolean))].sort().map((mt) => (
                <option key={mt} value={mt}>{mt}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-0.5 text-xs text-slate-500">All Tags</label>
            <select className={controlClass} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
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
            <label className="mb-0.5 text-xs text-slate-500">Sort by</label>
            <select className={controlClass} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="soonest">Due date: Soonest first</option>
              <option value="latest">Due date: Latest first</option>
              <option value="name">Customer name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Start date, End date + Fetch */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label className="mb-0.5 text-xs text-slate-500">Start date</label>
            <TypeableDateFilterInput value={startDate} onChange={setStartDate} className={controlClass}/>
          </div>
          <div className="flex flex-col">
            <label className="mb-0.5 text-xs text-slate-500">End date</label>
            <TypeableDateFilterInput value={endDate} onChange={setEndDate} className={controlClass}/>
          </div>
          <button
            className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 transition"
            onClick={handleFetch}
          >
            Fetch
          </button>
        </div>
      </div>

      {/* ── Cards + scroll arrows ── */}
      <div className="relative flex items-center">
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition -translate-x-1/2"
          aria-label="Scroll left"
        >
          ‹
        </button>

        <div
          ref={scrollRef}
          className="w-full overflow-x-auto py-4 hide-scrollbar"
          style={{ scrollBehavior: "smooth" }}
        >
          <div className="flex flex-row flex-nowrap gap-4 px-4">
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
              <div className="py-6 text-sm text-gray-500">
                No upcoming leads found.
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => scroll(1)}
          className="absolute right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition translate-x-1/2"
          aria-label="Scroll right"
        >
          ›
        </button>
      </div>
    </div>
  );
}
