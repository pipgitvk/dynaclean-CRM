import Link from "next/link";

export function parseUpcomingInstallationServiceDetails(blob) {
  if (blob == null || String(blob).trim() === "") return [];
  return String(blob)
    .split(";;")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [id, status, scheduledDate, assignedTo] = part.split("~");
      return {
        serviceId: id?.trim() || "",
        status: status?.trim() || "—",
        scheduledDate: scheduledDate?.trim() || "—",
        assignedTo: assignedTo?.trim() || "—",
      };
    });
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
            {item.status && item.status !== "—" && (
              <span className="ml-1 text-gray-600">({item.status})</span>
            )}
          </div>
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
