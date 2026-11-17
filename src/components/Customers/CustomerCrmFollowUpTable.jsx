"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Calendar,
  FileText,
  Mail,
  Phone,
  Video,
} from "lucide-react";
import {
  formatCrmDatetimeForISTDisplay,
  getCrmInstantMs,
} from "@/lib/timezone";
import { pickNextFollowupField } from "@/lib/customerFollowupDisplay";

function resolveFollowupType(commMode) {
  const raw = String(commMode || "").trim();
  const m = raw.toLowerCase();

  if (!raw || raw === "-" || raw === "—") {
    return {
      label: "Notes",
      Icon: FileText,
      className: "bg-amber-100 text-amber-900 border-amber-200",
    };
  }
  if (
    m.includes("call") ||
    m.includes("whatsapp") ||
    m.includes("phone") ||
    m.includes("sms")
  ) {
    return {
      label: "Call",
      Icon: Phone,
      className: "bg-blue-100 text-blue-900 border-blue-200",
    };
  }
  if (m.includes("email") || m.includes("mail")) {
    return {
      label: "Email",
      Icon: Mail,
      className: "bg-emerald-100 text-emerald-900 border-emerald-200",
    };
  }
  if (
    m.includes("meet") ||
    m.includes("demo") ||
    m.includes("visit") ||
    m.includes("video")
  ) {
    return {
      label: "Meeting",
      Icon: Video,
      className: "bg-violet-100 text-violet-900 border-violet-200",
    };
  }
  return {
    label: raw.length > 18 ? `${raw.slice(0, 16)}…` : raw,
    Icon: FileText,
    className: "bg-slate-100 text-slate-800 border-slate-200",
  };
}

function isTlFollowupEntry(entry) {
  return String(entry?.followup_source || "").trim().toUpperCase() === "TL";
}

function getContactDisplayName(entry) {
  return (
    String(entry.contact_name || entry.contact_label || "")
      .replace(/\s*\(ID:\s*\d+\)\s*$/i, "")
      .trim() || ""
  );
}

function FollowupTagsCell({ multiTag }) {
  const raw = String(multiTag || "").trim();
  if (!raw) {
    return <span className="text-gray-400">—</span>;
  }
  const parts = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (!parts.length) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-block rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900 break-words"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export default function CustomerCrmFollowUpTable({
  entries = [],
  userRole = "",
  defaultCustomerId = null,
  defaultCustomerName = "",
}) {
  const nameOptions = useMemo(() => {
    const map = new Map();
    if (defaultCustomerId && defaultCustomerName) {
      map.set(String(defaultCustomerId), String(defaultCustomerName).trim());
    }
    for (const entry of entries) {
      const id = entry.customer_id;
      if (!id) continue;
      const name = getContactDisplayName(entry);
      if (!name) continue;
      map.set(String(id), name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, defaultCustomerId, defaultCustomerName]);

  const [nameFilter, setNameFilter] = useState("all");

  const rows = useMemo(() => {
    const cutoff = dayjs().subtract(6, "month").valueOf();
    return [...entries]
      .filter((entry) => {
        const ms = getCrmInstantMs(
          entry.followed_date || entry.time_stamp || entry.created_at,
        );
        return !ms || ms >= cutoff;
      })
      .filter((entry) => {
        if (nameFilter === "all") return true;
        const rowId = entry.customer_id ?? defaultCustomerId;
        return String(rowId || "") === nameFilter;
      })
      .sort(
        (a, b) =>
          getCrmInstantMs(b.followed_date || b.time_stamp) -
          getCrmInstantMs(a.followed_date || a.time_stamp),
      );
  }, [entries, nameFilter, defaultCustomerId]);

  return (
    <div className="overflow-x-auto rounded-xl border border-violet-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-violet-100/90 text-left text-xs font-semibold uppercase tracking-wide text-violet-950">
            <th className="px-4 py-3 text-left normal-case min-w-[9rem]">
              <select
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="w-full min-w-[120px] max-w-[200px] rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 normal-case"
                aria-label="Filter by name"
              >
                <option value="all">All Names</option>
                {nameOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.id})
                  </option>
                ))}
              </select>
            </th>
            <th className="px-4 py-3 whitespace-nowrap">Next Follow-up Date</th>
            <th className="px-4 py-3 whitespace-nowrap">Follow-up Type</th>
            <th className="px-4 py-3 whitespace-nowrap">Follow-up Date</th>
            <th className="px-4 py-3 whitespace-nowrap">Followed By</th>
            <th className="px-4 py-3 min-w-[12rem]">Remarks</th>
            <th className="px-4 py-3 whitespace-nowrap">Mode</th>
            <th className="px-4 py-3 min-w-[7rem]">Tags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                No follow-ups in the last 6 months.
              </td>
            </tr>
          ) : (
            rows.map((entry, index) => {
              const followedAt = entry.followed_date || entry.time_stamp;
              const nextFollowup = pickNextFollowupField(entry, userRole);
              const type = resolveFollowupType(entry.comm_mode);
              const TypeIcon = type.Icon;
              const tlRow =
                isTlFollowupEntry(entry) &&
                String(entry?.notes || "").trim().length > 0;
              const modeLabel = entry.comm_mode?.trim()
                ? entry.comm_mode
                : isTlFollowupEntry(entry)
                  ? "TL"
                  : "—";

              return (
                <tr
                  key={`${followedAt || "row"}-${index}`}
                  className={tlRow ? "bg-yellow-100/80" : "bg-white even:bg-gray-50/40"}
                >
                  <td className="px-4 py-3 align-top text-gray-800">
                    <div className="font-semibold text-gray-900 leading-snug">
                      {getContactDisplayName(entry) ||
                        defaultCustomerName ||
                        "—"}
                    </div>
                    {(entry.customer_id ?? defaultCustomerId) ? (
                      <div className="mt-0.5 text-xs text-gray-500">
                        ID: {entry.customer_id ?? defaultCustomerId}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-emerald-600" />
                      {nextFollowup
                        ? formatCrmDatetimeForISTDisplay(
                            nextFollowup,
                            "DD-MM-YYYY hh:mm A",
                          )
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${type.className}`}
                    >
                      <TypeIcon className="h-3.5 w-3.5 shrink-0" />
                      {type.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-violet-500" />
                      {followedAt
                        ? formatCrmDatetimeForISTDisplay(
                            followedAt,
                            "DD-MM-YYYY hh:mm A",
                          )
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    <span className="font-medium">
                      {entry.followed_by?.trim() ? entry.followed_by : "—"}
                    </span>
                    {entry.followup_source === "TL" ? (
                      <span className="ml-1.5 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        TL
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    <div className="whitespace-pre-wrap break-words leading-snug">
                      {entry.notes?.trim() ? entry.notes : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-medium">
                    {modeLabel}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <FollowupTagsCell multiTag={entry.multi_tag} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}