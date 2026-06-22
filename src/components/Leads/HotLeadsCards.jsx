"use client";
import { useEffect, useState } from "react";
import { Phone, CalendarDays, Tag, Layers, Clock } from "lucide-react";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";

// Urgency color based on age: oldest (6d) = red, middle = light yellow, newest = light green
function getUrgencyColor(ageHours) {
  const ageDays = ageHours / 24;

  if (ageDays >= 5) return "rgb(239,68,68)";      // red-500
  if (ageDays >= 3) return "rgb(250,204,21)";      // yellow-400
  return              "rgb(134,239,172)";           // green-300
}

function getUrgencyLabel(ageHours) {
  const days = Math.floor(ageHours / 24);
  if (days >= 5) return { text: "Critical", bg: "bg-red-100 text-red-700" };
  if (days >= 3) return { text: "Medium",   bg: "bg-yellow-100 text-yellow-700" };
  return           { text: "Fresh",      bg: "bg-green-100 text-green-700" };
}

function HotLeadCard({ cust }) {
  const ageHours = cust.lead_age_hours || 0;
  const ageDays  = Math.floor(ageHours / 24);
  const ageLabel = ageDays === 0
    ? `${ageHours}h old`
    : ageDays === 1 ? "1 day old"
    : `${ageDays} days old`;

  const barColor  = getUrgencyColor(ageHours);
  const urgency   = getUrgencyLabel(ageHours);

  return (
    <div className="w-[280px] flex-shrink-0 rounded-xl overflow-hidden shadow border border-gray-100 bg-white flex flex-col hover:shadow-md transition-shadow duration-200">

      {/* Urgency bar */}
      <div className="h-1 w-full" style={{ backgroundColor: barColor }} />

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {cust.first_name || "—"}
          </p>
          {cust.company && (
            <p className="text-xs text-gray-400 truncate">{cust.company}</p>
          )}
        </div>
        {/* Age badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: barColor }}
          >
            {ageLabel}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgency.bg}`}>
            {urgency.text}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-100" />

      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Phone size={12} className="shrink-0 text-gray-400" />
          <span className="truncate">{cust.phone || "—"}</span>
        </div>

        {cust.products_interest && (
          <div className="flex items-start gap-2 text-xs text-gray-500">
            <Tag size={12} className="shrink-0 text-gray-400 mt-0.5" />
            <span className="line-clamp-2">{cust.products_interest}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Layers size={12} className="shrink-0 text-gray-400" />
          <span className="truncate">{cust.stage || "—"}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CalendarDays size={12} className="shrink-0 text-gray-400" />
          <span className="truncate">
            {cust.next_followup_date
              ? formatCrmDatetimeForISTDisplay(cust.next_followup_date)
              : "No follow-up set"}
          </span>
        </div>

        {/* Status pill */}
        <div className="mt-1">
          <span className="inline-block text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {cust.status || "—"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <a
          href={`/user-dashboard/view-customer/${cust.customer_id}`}
          className="flex-1 text-center text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg py-2 transition-colors"
        >
          View
        </a>
        <a
          href={`/user-dashboard/view-customer/${cust.customer_id}/follow-up`}
          className="flex-1 text-center text-xs font-medium text-white rounded-lg py-2 transition-colors"
          style={{ backgroundColor: barColor }}
        >
          Follow Up
        </a>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="w-[280px] flex-shrink-0 rounded-xl border border-gray-100 bg-white overflow-hidden">
      <div className="h-1 bg-gray-200 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <div className="flex-1 h-8 bg-gray-100 rounded-lg animate-pulse" />
        <div className="flex-1 h-8 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default function HotLeadsCards({ leadSource }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    async function fetchHotLeads() {
      setLoading(true);
      try {
        const res = await fetch(`/api/fresh-leads?leadSource=${leadSource}`);
        const data = await res.json();
        setLeads(data.leads || []);
      } catch (err) {
        console.error("Failed to fetch hot leads", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHotLeads();
  }, [leadSource]);

  // Process leads with date filter, status filter, and custom sorting
  const processedLeads = (() => {
    let filtered = [...leads];

    // Apply date filter: exclude leads created on or after the selected date
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter((lead) => {
        const leadDate = new Date(lead.created_at || lead.date_created);
        return leadDate < filterDate;
      });
    }

    if (statusFilter !== "ALL") {
      filtered = filtered.filter(
        (c) => String(c.status || "").toLowerCase() === statusFilter.toLowerCase()
      );
    }
    if (stageFilter !== "ALL") {
      filtered = filtered.filter(
        (c) => String(c.stage || "").toLowerCase() === stageFilter.toLowerCase()
      );
    }

    // Custom sort:
    // 1. Leads with stage containing "won" or "order" go to bottom
    // 2. Others sorted by age (oldest first = most urgent)
    filtered.sort((a, b) => {
      const aStageNorm = (a.stage || "").trim().toLowerCase();
      const bStageNorm = (b.stage || "").trim().toLowerCase();
      
      // Check if stage contains "won" (case insensitive)
      const aIsWonOrOrdered = aStageNorm.includes("won");
      const bIsWonOrOrdered = bStageNorm.includes("won");

      // Debug log
      if (a.first_name === "Nikhil Agarwal" || b.first_name === "Nikhil Agarwal") {
        console.log("Debug sort:", {
          aName: a.first_name,
          aStage: a.stage,
          aStageNorm,
          aIsWonOrOrdered,
          bName: b.first_name,
          bStage: b.stage,
          bStageNorm,
          bIsWonOrOrdered,
        });
      }

      if (aIsWonOrOrdered && !bIsWonOrOrdered) return 1;
      if (!aIsWonOrOrdered && bIsWonOrOrdered) return -1;
      
      // If both are won/ordered or both are not, sort by age (oldest first)
      return (b.lead_age_hours || 0) - (a.lead_age_hours || 0);
    });

    return filtered;
  })();

  return (
    <div className="bg-white lg:p-6 rounded-xl shadow-md mx-auto mt-2">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">
              Hot Leads
            </h2>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Status</label>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {[...new Set(leads.map((l) => l.status).filter(Boolean))]
                .sort((a, b) => String(a).localeCompare(String(b)))
                .map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Stage</label>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="ALL">All stages</option>
              {[...new Set(leads.map((l) => l.stage).filter(Boolean))]
                .sort((a, b) => String(a).localeCompare(String(b)))
                .map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400 mb-3">
        Showing {processedLeads.length} of {leads.length} leads
      </p>

      {/* Horizontal scroll */}
      <div className="w-full md:w-[77vw] lg:w-[71vw] overflow-x-scroll py-2 hide-scrollbar">
        <div className="flex flex-row gap-4 flex-nowrap min-w-max">
          {loading ? (
            [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
          ) : processedLeads.length > 0 ? (
            processedLeads.map((cust) => (
              <HotLeadCard key={cust.customer_id} cust={cust} />
            ))
          ) : (
            <div className="text-gray-400 text-sm py-8 px-4">
              No hot leads found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
