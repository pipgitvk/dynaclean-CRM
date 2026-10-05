import { getCrmInstantMs } from "@/lib/timezone";

/**
 * Client-side filters for Upcoming Enquiry (cards + table), matching dashboard UI.
 */
export function applyUpcomingLeadsClientFilters(
  leads,
  appliedFilters,
  isServiceSupport
) {
  let filtered = [...leads];

  const invalidStatuses = isServiceSupport
    ? ["invalid", "disqualified"]
    : ["invalid", "disqualified", "denied"];
  filtered = filtered.filter(
    (c) => !invalidStatuses.includes((c.status || "").trim().toLowerCase())
  );

  if (isServiceSupport) {
    filtered = filtered.filter((cust) => cust.service_next_followup);
  }

  if (appliedFilters.statusFilter && appliedFilters.statusFilter !== "ALL") {
    filtered = filtered.filter(
      (cust) =>
        String(cust.status || "").toLowerCase() ===
        appliedFilters.statusFilter.toLowerCase()
    );
  }

  if (appliedFilters.stageFilter && appliedFilters.stageFilter !== "ALL") {
    filtered = filtered.filter(
      (cust) =>
        String(cust.stage || "").toLowerCase() ===
        appliedFilters.stageFilter.toLowerCase()
    );
  }

  if (appliedFilters.multiTagFilter && appliedFilters.multiTagFilter !== "ALL") {
    filtered = filtered.filter((cust) => {
      const tags = String(cust.multi_tag || "")
        .split(",")
        .map((t) => t.trim());
      return tags.some((t) => t === appliedFilters.multiTagFilter);
    });
  }

  if (appliedFilters.tagFilter && appliedFilters.tagFilter !== "") {
    filtered = filtered.filter((cust) => cust.tags === appliedFilters.tagFilter);
  }

  if (appliedFilters.startDate || appliedFilters.endDate) {
    const dateField = isServiceSupport
      ? "service_next_followup"
      : "next_followup_date";
    const sd = appliedFilters.startDate
      ? new Date(appliedFilters.startDate + "T00:00:00")
      : null;
    const ed = appliedFilters.endDate
      ? new Date(appliedFilters.endDate + "T23:59:59")
      : null;
    filtered = filtered.filter((cust) => {
      if (!cust[dateField]) return false;
      const leadDate = new Date(cust[dateField]);
      if (sd && leadDate < sd) return false;
      if (ed && leadDate > ed) return false;
      return true;
    });
  }

  filtered.sort((a, b) => {
    if (appliedFilters.sortOrder === "name") {
      return (a.first_name || "").localeCompare(b.first_name || "");
    }
    const dateField = isServiceSupport
      ? "service_next_followup"
      : "next_followup_date";
    const aTime = a[dateField] ? getCrmInstantMs(a[dateField]) : Infinity;
    const bTime = b[dateField] ? getCrmInstantMs(b[dateField]) : Infinity;
    if (appliedFilters.sortOrder === "latest") return bTime - aTime;
    return aTime - bTime;
  });

  return filtered;
}

export const defaultUpcomingLeadsFilters = () => {
  const today = new Date().toISOString().split("T")[0];
  return {
    sortOrder: "soonest",
    startDate: "",
    endDate: today,
    statusFilter: "ALL",
    stageFilter: "ALL",
    multiTagFilter: "ALL",
    tagFilter: "",
  };
};
