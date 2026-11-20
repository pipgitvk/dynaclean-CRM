import Link from "next/link";

export function parseUpcomingInstallationServiceDetails(blob) {
  if (blob == null || String(blob).trim() === "") return [];
  return String(blob)
    .split(";;")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [id, status, scheduledDate, assignedTo, statusDescription] = part.split("~");
      return {
        serviceId: id?.trim() || "",
        status: status?.trim() || "—",
        scheduledDate: scheduledDate?.trim() || "—",
        assignedTo: assignedTo?.trim() || "—",
        statusDescription: statusDescription?.trim() || "",
      };
    });
}

export function serializeUpcomingInstallationServiceDetails(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .map((it) =>
      [
        it.serviceId || "",
        it.status && it.status !== "—" ? it.status : "",
        it.scheduledDate && it.scheduledDate !== "—" ? it.scheduledDate : "",
        it.assignedTo && it.assignedTo !== "—" ? it.assignedTo : "",
        it.statusDescription || "",
      ].join("~"),
    )
    .join(";;");
}

function serviceStatusBadgeClass(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "COMPLETED" || s === "WORKED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (s === "PENDING" || s === "PLANNED" || s === "IN PROGRESS") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (s === "PENDING FOR SPARES" || s === "PENDING BY CUSTOMER") {
    return "border-orange-200 bg-orange-50 text-orange-900";
  }
  if (s === "CANCELLED") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatScheduledDate(ymd) {
  if (!ymd || ymd === "—") return "—";
  const s = String(ymd).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ymd;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return ymd;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Service ID, status, scheduled date, assigned person from service_records. */
export default function UpcomingInstallationServiceStatusColumn({
  record,
  serviceDetailsHrefBase = "/admin-dashboard/complete-service",
}) {
  const items = parseUpcomingInstallationServiceDetails(record?.service_details);

  if (items.length === 0) {
    const fallbackId = record?.service_id?.trim();
    if (!fallbackId) {
      return <span className="text-gray-400 text-xs">—</span>;
    }
    return (
      <div className="text-xs sm:text-sm space-y-0.5 min-w-[10rem]">
        <div>
          <span className="text-gray-500 font-medium">ID:</span>{" "}
          <Link
            href={`${serviceDetailsHrefBase}/${fallbackId}`}
            className="text-purple-700 font-semibold hover:underline"
          >
            {fallbackId}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-snug min-w-[11rem]">
      {items.map((item) => (
        <div
          key={item.serviceId}
          className="border-b border-gray-100 last:border-0 pb-1.5 last:pb-0"
        >
          <div>
            <span className="text-gray-500 font-medium">ID:</span>{" "}
            <Link
              href={`${serviceDetailsHrefBase}/${item.serviceId}`}
              className="text-purple-700 font-semibold hover:underline"
            >
              {item.serviceId}
            </Link>
          </div>
          {item.status && item.status !== "—" ? (
            <div className="mt-0.5">
              <span
                className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${serviceStatusBadgeClass(item.status)}`}
              >
                {item.status}
              </span>
            </div>
          ) : null}
          <div>
            <span className="text-gray-500 font-medium">S Date:</span>{" "}
            {formatScheduledDate(item.scheduledDate)}
          </div>
          <div>
            <span className="text-gray-500 font-medium">Assigned:</span>{" "}
            <span className="text-gray-800">{item.assignedTo}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
