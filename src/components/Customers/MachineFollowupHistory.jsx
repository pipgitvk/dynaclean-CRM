"use client";

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = "Asia/Kolkata";

export default function MachineFollowupHistory({ records = [], warrantyProducts = [] }) {
  if (records.length === 0) {
    return (
      <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
        <h2 className="text-xl font-semibold mb-3 text-gray-800 border-b pb-3 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-purple-500" />
          Machine Follow-up History
        </h2>
        <p className="text-gray-400 text-sm py-4 text-center">
          No machine follow-up history found for this customer.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-3 flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full bg-purple-500" />
        Machine Follow-up History
        <span className="ml-2 text-xs font-normal bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
          {records.length} record{records.length !== 1 ? "s" : ""}
        </span>
      </h2>

      {/* Warranty products matched */}
      {warrantyProducts.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {warrantyProducts.map((wp) => (
            <span
              key={wp.serial_number}
              className="text-xs bg-gray-100 border border-gray-200 rounded-full px-3 py-1 text-gray-600"
            >
              🔧 {wp.model || wp.product_name} — <span className="font-semibold">{wp.serial_number}</span>
            </span>
          ))}
        </div>
      )}

      {/* Timeline */}
      <ol className="relative border-l-2 border-purple-200 ml-2">
        {records.map((rec, idx) => (
          <li key={rec.id} className="mb-6 ml-5">
            <span
              className={`absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${
                idx === 0 ? "bg-purple-600" : "bg-gray-400"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white" />
            </span>

            <div
              className={`p-4 rounded-lg border ${
                idx === 0
                  ? "bg-purple-50 border-purple-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {idx === 0 && (
                    <span className="text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">
                      Latest
                    </span>
                  )}
                  <span className="text-xs text-gray-400">#{rec.id}</span>
                  {rec.serial_number && (
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                      {rec.serial_number}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  By <span className="font-semibold text-gray-700">{rec.added_by}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-500">Followed At:</span>{" "}
                  <span className="font-medium">
                    {rec.followed_at
                      ? dayjs(rec.followed_at).tz(IST).format("DD/MM/YYYY HH:mm")
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Next Follow-up:</span>{" "}
                  <span className="font-medium">
                    {rec.next_followup_date
                      ? dayjs(rec.next_followup_date).tz(IST).format("DD/MM/YYYY HH:mm")
                      : "—"}
                  </span>
                </div>
                {rec.product_model && (
                  <div>
                    <span className="text-gray-500">Model:</span>{" "}
                    <span className="font-medium">{rec.product_model}</span>
                  </div>
                )}
                {rec.contact && (
                  <div>
                    <span className="text-gray-500">Contact:</span>{" "}
                    <span className="font-medium">{rec.contact}</span>
                  </div>
                )}
                {rec.notes && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-500">Notes:</span>{" "}
                    <span className="font-medium">{rec.notes}</span>
                  </div>
                )}
                {rec.image && (
                  <div className="sm:col-span-2 mt-1">
                    <a
                      href={rec.image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      View Image
                    </a>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
