"use client";

import dayjs from "dayjs";
import { ArrowDown, ArrowUp } from "lucide-react";

export const SCHEDULE_DATE_SORT_KEYS = [
  "delivery_dates",
  "installation_dates",
  "due_date",
];

export const SCHEDULE_DATE_SORT_LABELS = {
  delivery_dates: "Delivery",
  installation_dates: "Installation",
  due_date: "Due",
};

export function nextScheduleDateSortConfig(prev) {
  if (!SCHEDULE_DATE_SORT_KEYS.includes(prev.key)) {
    return { key: "due_date", direction: "asc" };
  }
  if (prev.direction === "asc") {
    return { ...prev, direction: "desc" };
  }
  const idx = SCHEDULE_DATE_SORT_KEYS.indexOf(prev.key);
  const nextKey =
    SCHEDULE_DATE_SORT_KEYS[(idx + 1) % SCHEDULE_DATE_SORT_KEYS.length];
  return { key: nextKey, direction: "asc" };
}

export function PaymentScheduleDatesCell({ order, isOverdue }) {
  return (
    <div className="space-y-1.5 text-xs text-gray-800 min-w-[6.5rem]">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Delivery
        </div>
        {order.delivery_dates?.length ? (
          <div className="space-y-0.5 mt-0.5">
            {order.delivery_dates.map((d) => (
              <div key={d}>{dayjs(d).format("DD-MM-YYYY")}</div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 mt-0.5">—</div>
        )}
      </div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Installation
        </div>
        {order.installation_dates?.length ? (
          <div className="space-y-0.5 mt-0.5">
            {order.installation_dates.map((d) => (
              <div key={d}>{dayjs(d).format("DD-MM-YYYY")}</div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 mt-0.5">—</div>
        )}
      </div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
          Due
        </div>
        {order.due_date ? (
          <span
            className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              isOverdue
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {dayjs(order.due_date).format("DD-MM-YYYY")}
            {isOverdue ? " ⚠️" : ""}
          </span>
        ) : (
          <div className="text-gray-400 mt-0.5">—</div>
        )}
      </div>
    </div>
  );
}

export function PaymentScheduleColumnHeader({ sortConfig, onSort }) {
  return (
    <th
      className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-700 transition-colors min-w-[7rem]"
      onClick={onSort}
      title="Click to sort: Due → Delivery → Installation"
    >
      <span className="block text-xs font-semibold leading-tight">
        Delivery / Installation / Due
      </span>
      {SCHEDULE_DATE_SORT_KEYS.includes(sortConfig.key) ? (
        <span className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] font-normal text-gray-300">
          Sort: {SCHEDULE_DATE_SORT_LABELS[sortConfig.key]}
          {sortConfig.direction === "asc" ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )}
        </span>
      ) : null}
    </th>
  );
}