"use client";
import { useEffect, useState } from "react";
import TaskCard from "./TLTaskCard";
import { getGradientColor } from "@/utils/getGradientColor";
import dayjs from "dayjs";

function SkeletonCard() {
  return (
    <div className="w-[300px] h-32 bg-gray-200 animate-pulse rounded-xl shadow flex-shrink-0" />
  );
}

export default function UpcomingTeamLeaderFollowupsCards({ teamLeader }) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState("soonest"); // soonest | latest | name
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");

  useEffect(() => {
    async function fetchFollowups() {
      setLoading(true);
      try {
        const res = await fetch(`/api/upcoming-tl-followups?teamLeader=${teamLeader}`);
        const data = await res.json();
        setFollowups(data.followups || []);
        console.log("Fetched TL followups:", data.followups);
      } catch (err) {
        console.error("Failed to fetch TL followups", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFollowups();
  }, [teamLeader]);

  // Prepare filtered and sorted followups
  const processedFollowups = (() => {
    let filtered = [...followups];

    // Status filtering
    if (statusFilter && statusFilter !== "ALL") {
      const wanted = String(statusFilter).toLowerCase();
      filtered = filtered.filter((f) =>
        String(f.status || "").toLowerCase() === wanted
      );
    }

    // Stage filtering
    if (stageFilter && stageFilter !== "ALL") {
      const wantedStage = String(stageFilter).toLowerCase();
      filtered = filtered.filter((f) =>
        String(f.stage || "").toLowerCase() === wantedStage
      );
    }

    // Date filtering (by next_followup_date)
    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
      filtered = filtered.filter((followup) => {
        if (!followup.next_followup_date) return false; // hide if no date when filter applied
        const d = new Date(followup.next_followup_date);
        if (Number.isNaN(d.getTime())) return false;
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
      const aTime = a.next_followup_date ? new Date(a.next_followup_date).getTime() : Infinity;
      const bTime = b.next_followup_date ? new Date(b.next_followup_date).getTime() : Infinity;
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
          Showing {processedFollowups.length} of {followups.length} TL followups
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
              {[...new Set(followups.map((l) => l.status).filter(Boolean))]
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
              {[...new Set(followups.map((l) => l.stage).filter(Boolean))]
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
          ) : processedFollowups.length > 0 ? (
            processedFollowups.map((followup) => {
              const hours = followup.next_followup_date
                ? (new Date(followup.next_followup_date).getTime() - Date.now()) /
                  3600000
                : null;
              const bgColor = followup.next_followup_date
                ? getGradientColor(hours)
                : "rgb(255, 165, 0)";
              return (
                <div
                  key={followup.customer_id}
                  className="w-[300px] flex-shrink-0"
                >
                  <TaskCard
                    customerId={followup.customer_id}
                    name={followup.first_name}
                    contact={followup.phone}
                    products_interest={followup.products_interest}
                    stage={followup.stage}
                    dueDate={
                      followup.next_followup_date
                        ? dayjs(followup.next_followup_date).format(
                          "DD MMM, YYYY hh:mm A"
                        )
                        : "Not set"
                    }
                    notes={followup.tl_notes}
                    status={followup.status}
                    bgColor={bgColor}
                  />
                </div>
              );
            })
          ) : (
            <div className="text-center w-full text-gray-500">
              No upcoming TL followups found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
