import Link from "next/link";
import { CalendarDays, Phone, MapPin } from "lucide-react";

const TaskCard = ({
  customerId,
  name,
  contact,
  company,
  products_interest,
  stage,
  dueDate,
  notes,
  status,
  bgColor,
  dashboardPrefix = "/user-dashboard",
  variant = "default",
}) => {
  const detailsBasePath =
    variant === "sales" ? "/user-dashboard" : dashboardPrefix;

  if (variant === "sales") {
    return (
      <div
        className="flex min-h-[280px] w-[260px] shrink-0 flex-col justify-between rounded-xl border border-gray-200 p-4 text-white shadow-sm transition hover:shadow-md"
        style={{ backgroundColor: bgColor }}
      >
        <div>
          <h3 className="mb-2 line-clamp-1 text-sm font-bold text-white">
            {name}
          </h3>

          <div className="mb-1.5 flex items-center gap-2 text-xs text-white/90">
            <Phone size={13} className="shrink-0 text-white/70" />
            <span className="truncate">{contact || "—"}</span>
          </div>

          <div className="mb-3 flex items-center gap-2 text-xs text-white/90">
            <MapPin size={13} className="shrink-0 text-white/70" />
            <span className="truncate">{company || "Company not added"}</span>
          </div>

          <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-white/90">
            {notes || "No notes"}
          </p>

          <p className="mb-3 line-clamp-2 text-xs font-medium text-white">
            {products_interest || "Product not added"}
          </p>

          <div className="space-y-1.5 text-xs text-white/90">
            <div className="flex items-center gap-2">
              <CalendarDays size={13} className="shrink-0 text-white/70" />
              <span>{dueDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-300" />
              <span className="truncate">{status || "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-200" />
              <span className="truncate">{stage || "—"}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 border-t border-white/20 pt-3">
          <Link
            href={`${detailsBasePath}/view-customer/${customerId}`}
            className="text-xs font-semibold text-white/90 transition hover:text-white"
          >
            View
          </Link>
          <Link
            href={`${detailsBasePath}/view-customer/${customerId}/follow-up?source=upcoming`}
            className="text-xs font-semibold text-white/90 transition hover:text-white"
          >
            Follow
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-w-[250px] max-w-[300px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 text-white shadow-md transition duration-300 hover:shadow-lg"
      style={{ backgroundColor: bgColor }}
    >
      <div>
        <h3 className="text-s mb-1 line-clamp-1 text-white">{name}</h3>

        <div className="text-white-600 mb-1 flex items-center gap-2 text-xs">
          <Phone size={14} className="text-gray-200" />
          <span>{contact}</span>
        </div>

        <div className="mb-3 text-xs font-medium text-white">
          📍 {company || "Company not added"}
        </div>

        <p className="mb-4 line-clamp-3 text-sm text-white">
          {notes || "No notes"}
        </p>

        <p className="mb-4 line-clamp-3 text-sm text-white">
          {products_interest || "products not showing"}
        </p>

        <div className="space-y-2 text-xs font-medium text-white">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-gray-200" />
            <span>Scheduled: {dueDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            <span>Status: {status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>Stage: {stage || "-"}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <a
          href={`${detailsBasePath}/view-customer/${customerId}`}
          className="text-s flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 font-semibold text-gray-600 transition"
        >
          View
        </a>
        <a
          href={`${detailsBasePath}/view-customer/${customerId}/follow-up?source=upcoming`}
          className="text-s flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 font-semibold text-gray-600 transition"
        >
          Follow
        </a>
      </div>
    </div>
  );
};

export default TaskCard;
