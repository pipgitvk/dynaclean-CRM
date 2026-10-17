"use client";

const OPTIONS = [
  { id: "all", label: "All", active: "bg-gray-800 text-white", idle: "bg-gray-200 text-gray-800 hover:bg-gray-300" },
  {
    id: "completed",
    label: "Completed Delivery",
    active: "bg-green-600 text-white",
    idle: "bg-green-100 text-green-900 hover:bg-green-200 border border-green-300",
  },
  {
    id: "late",
    label: "Late Delivery",
    active: "bg-red-600 text-white",
    idle: "bg-red-100 text-red-900 hover:bg-red-200 border border-red-300",
  },
  {
    id: "incoming",
    label: "Incoming Delivery",
    active: "bg-yellow-500 text-white",
    idle: "bg-yellow-100 text-yellow-900 hover:bg-yellow-200 border border-yellow-300",
  },
];

export default function UpcomingInstallationStatusFilter({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-sm font-medium text-gray-600 self-center mr-1">
        Status:
      </span>
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1.5 rounded font-medium text-sm transition ${
            value === opt.id ? opt.active : opt.idle
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
