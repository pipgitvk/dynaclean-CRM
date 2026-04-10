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

export default function UpcomingLeadsCards({ leadSource }) {
  const [leads, setLeads] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState("soonest"); // soonest | latest | name
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL or specific status
  const [stageFilter, setStageFilter] = useState("ALL"); // ALL or specific stage

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/upcoming-leads?leadSource=${encodeURIComponent(leadSource)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setLeads([]);
          setFetchError(data.error || "Could not load leads");
          return;
        }
        setLeads(data.leads || []);
      } catch (err) {
        console.error("Failed to fetch leads", err);
        setLeads([]);
        setFetchError(err.message || "Network error");
      } finally {
        setLoading(false);
      }
    }
    fetchLeads();
  }, [leadSource]);

  // Prepare filtered and sorted leads
  const processedLeads = (() => {
    let filtered = [...leads];

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

    // Date filtering (by next_followup_date)
    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
      filtered = filtered.filter((cust) => {
        if (!cust.next_followup_date) return false; // hide if no date when filter applied
        const ms = getCrmInstantMs(cust.next_followup_date);
        if (!ms) return false;
        const d = new Date(ms);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sortOrder === "name") {
        return (a.first_name || "").localeCompare(b.first_name || "");
      }
      const aTime = a.next_followup_date
        ? getCrmInstantMs(a.next_followup_date)
        : Infinity;
      const bTime = b.next_followup_date
        ? getCrmInstantMs(b.next_followup_date)
        : Infinity;
      if (sortOrder === "latest") return bTime - aTime; // latest first
      return aTime - bTime; // default soonest first
    });

    return filtered;
  })();

  return (
    <div className="bg-white lg:p-6 rounded-xl shadow-md mx-auto mt-2">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
        <p className="text-sm text-gray-500">
          Showing {processedLeads.length} of {leads.length} leads
          {fetchError ? (
            <span className="ml-2 text-red-600">({fetchError})</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Status</label>
            <select
              className="border rounded-md px-3 py-2 text-sm"
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
            <label className="text-xs text-gray-600 mb-1">Stage</label>
            <select
              className="border rounded-md px-3 py-2 text-sm"
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
            <label className="text-xs text-gray-600 mb-1">Sort by</label>
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="soonest">Due date: Soonest first</option>
              <option value="latest">Due date: Latest first</option>
              <option value="name">Customer name (A-Z)</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Start date</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">End date</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {(startDate || endDate) && (
            <button
              className="border rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Horizontal slider */}
      <div className="w-full md:w-[77vw] lg:w-[71vw] overflow-x-scroll py-5 hide-scrollbar">
        <div className="flex flex-row gap-4 flex-nowrap min-w-max">
          {loading ? (
            [...Array(6)].map((_, i) => <SkeletonCard key={i} />)
          ) : processedLeads.length > 0 ? (
            processedLeads.map((cust) => {
              const hours = cust.next_followup_date
                ? (getCrmInstantMs(cust.next_followup_date) - Date.now()) / 3600000
                : null;
              const bgColor = cust.next_followup_date
                ? getGradientColor(hours)
                : "rgb(255, 165, 0)";
              return (
                <div
                  key={cust.customer_id}
                  className="w-[300px] flex-shrink-0"
                >
                  <TaskCard
                    customerId={cust.customer_id}
                    name={cust.first_name}
                    contact={cust.phone}
                    products_interest={cust.products_interest}
                    stage={cust.stage}
                    dueDate={
                      cust.next_followup_date
                        ? formatCrmDatetimeForISTDisplay(cust.next_followup_date)
                        : "Not set"
                    }
                    notes={cust.notes}
                    status={cust.status}
                    bgColor={bgColor}
                  />
                </div>
              );
            })
          ) : (
            <div className="text-center w-full max-w-md mx-auto px-4 py-6 text-gray-500 text-sm space-y-2">
              <p className="font-medium text-gray-700">No leads to show here yet.</p>
              <p className="text-gray-500">
                Leads appear when you are set as <strong>lead source</strong>,{" "}
                <strong>sales representative</strong>, or <strong>assigned to</strong> on a customer,
                and that customer has at least one follow-up row.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
