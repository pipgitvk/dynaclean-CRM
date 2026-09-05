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

  // Default variant — matches the screenshot UI exactly
  return (
    <div
      className="flex w-[260px] shrink-0 flex-col justify-between rounded-xl p-4 text-white shadow-md transition duration-200 hover:shadow-lg hover:brightness-95"
      style={{ backgroundColor: bgColor }}
    >
      {/* Name */}
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-white line-clamp-1">
          {name}
        </h3>

        {/* Phone */}
        <div className="mb-1 flex items-center gap-2 text-xs text-white/90">
          <Phone size={13} className="shrink-0 text-white/70" />
          <span className="truncate">{contact || "—"}</span>
        </div>

        {/* Company */}
        <div className="mb-3 flex items-center gap-2 text-xs text-white/90">
          <MapPin size={13} className="shrink-0 text-white/70" />
          <span className="truncate">{company || "Company not added"}</span>
        </div>

        {/* Notes */}
        {notes && (
          <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-white/90">
            {notes}
          </p>
        )}

        {/* Product interest */}
        {products_interest && (
          <p className="mb-3 text-xs font-semibold text-white line-clamp-2">
            {products_interest}
          </p>
        )}

        {/* Date + status dots */}
        <div className="mt-2 space-y-1.5 text-xs text-white/90">
          <div className="flex items-center gap-2">
            <CalendarDays size={13} className="shrink-0 text-white/70" />
            <span>{dueDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-300" />
            <span className="truncate">{status || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-200" />
            <span className="truncate">{stage || "—"}</span>
          </div>
        </div>
      </div>

      {/* View / Follow links */}
      <div className="mt-4 flex items-center gap-4 border-t border-white/25 pt-3">
        <Link
          href={`${detailsBasePath}/view-customer/${customerId}`}
          className="text-xs font-semibold text-white transition hover:text-white/70"
        >
          View
        </Link>
        <Link
          href={`${detailsBasePath}/view-customer/${customerId}/follow-up?source=upcoming`}
          className="text-xs font-semibold text-white transition hover:text-white/70"
        >
          Follow
        </Link>
      </div>
    </div>
  );
};

export default TaskCard;
