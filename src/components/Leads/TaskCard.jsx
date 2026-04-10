import { CalendarDays, Phone, ArrowUpRight } from "lucide-react";

const TaskCard = ({
  customerId,
  name,
  contact,
  products_interest,
  stage,
  dueDate,
  notes,
  status,
  bgColor,
}) => {
  return (
    <div
      className="group relative flex min-w-[260px] max-w-[300px] flex-col justify-between overflow-hidden rounded-3xl shadow-[0_20px_45px_-12px_rgba(15,23,42,0.35)] ring-1 ring-white/20 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_28px_55px_-12px_rgba(15,23,42,0.45)]"
      style={{ background: bgColor }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/15" aria-hidden />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col p-6 text-white">
        <div className="mb-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">Lead</p>
          <h3 className="text-xl font-bold leading-tight tracking-tight drop-shadow-sm line-clamp-2">{name}</h3>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 ring-1 ring-white/10 backdrop-blur-[2px]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <Phone className="h-3.5 w-3.5 text-white/95" strokeWidth={2} />
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{contact}</span>
        </div>

        <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-white/95">{notes || "No notes"}</p>

        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-white/85">{products_interest || "—"}</p>

        <div className="space-y-2.5 rounded-xl bg-black/12 px-3 py-3 text-xs font-medium ring-1 ring-white/10 backdrop-blur-[2px]">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-white/90" />
            <span className="leading-snug">
              <span className="text-white/65">Scheduled · </span>
              {dueDate}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300 shadow-sm shadow-amber-900/30" />
            <span className="text-white/95">Status · {status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-sky-300 shadow-sm shadow-sky-900/30" />
            <span className="text-white/95">Stage · {stage || "—"}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-stretch gap-2 border-t border-white/15 bg-black/10 px-4 py-3 backdrop-blur-md">
        <a
          href={`/user-dashboard/view-customer/${customerId}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/25 bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          View
          <ArrowUpRight className="h-3.5 w-3.5 opacity-90" />
        </a>
        <a
          href={`/user-dashboard/view-customer/${customerId}/follow-up`}
          className="flex flex-1 items-center justify-center rounded-xl bg-white/20 py-2.5 text-sm font-semibold text-white shadow-inner transition hover:bg-white/30"
        >
          Follow
        </a>
      </div>
    </div>
  );
};

export default TaskCard;
