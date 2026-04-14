"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { CalendarDays, Edit, Eye, Sparkles, StickyNote, User } from "lucide-react";
import {
  NEXT_FOLLOWUP_DATE_TRAFFIC_LEGEND,
  getTrafficGradientForHours,
} from "@/utils/hiringFollowUpUrgency";
import { pickEffectiveNextFollowup } from "@/utils/tlNextFollowupResolve";

/** Hours until effective next follow-up — same instant as the Schedule line. */
function getHoursUntilNextFollowup(customer) {
  const next = pickEffectiveNextFollowup(customer);
  if (!next) return null;
  return next.diff(dayjs(), "hour", true);
}

function customerDisplayName(c) {
  const n = `${c.first_name || ""} ${c.last_name || ""}`.trim();
  if (n) return n;
  if (c.company) return c.company;
  return "—";
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 px-3 py-2.5 sm:px-3.5 sm:py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 shadow-none">
        <Icon className="h-4 w-4 text-slate-700" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <div className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{children}</div>
      </div>
    </div>
  );
}

function TLCustomerFollowUpCard({ customer, detailHref, followupHref }) {
  const hours = getHoursUntilNextFollowup(customer);
  const bg = getTrafficGradientForHours(hours);

  const nextD = pickEffectiveNextFollowup(customer);
  const nextLabel = nextD ? nextD.format("DD MMM, YYYY HH:mm") : "—";

  const tagParts = customer.multi_tag
    ? customer.multi_tag
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return (
    <div
      className="group relative flex h-full min-w-[288px] max-w-[308px] flex-shrink-0 flex-col justify-between overflow-hidden rounded-3xl p-0 text-white shadow-[0_22px_50px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/10 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_28px_60px_-12px_rgba(15,23,42,0.45)]"
      style={{ background: bg }}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              <Sparkles className="h-3 w-3 opacity-90" />
              Customer
            </p>
            <Link
              href={detailHref}
              className="block text-xl font-bold leading-tight tracking-tight text-white line-clamp-2 hover:underline"
            >
              {customerDisplayName(customer)}
            </Link>
          </div>
          <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white">
            #{customer.customer_id}
          </span>
        </div>

        <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <DetailRow icon={User} label="User">
            <span className="line-clamp-2">{customer.lead_source || "Unassigned"}</span>
          </DetailRow>
          <div className="flex gap-3 px-3 py-2.5 sm:px-3.5 sm:py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 shadow-none">
              <CalendarDays className="h-4 w-4 text-slate-700" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Schedule</p>
              <p className="text-sm font-medium text-cyan-800">
                Next follow-up · {nextLabel}
              </p>
            </div>
          </div>
          <DetailRow icon={StickyNote} label="Notes">
            <span className="line-clamp-4 whitespace-pre-wrap break-words">
              {customer.tl_notes?.trim() ? customer.tl_notes : "—"}
            </span>
          </DetailRow>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {tagParts.length > 0 ? (
            tagParts.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-[10px] font-semibold text-white/95"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80">
              No tag
            </span>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            href={detailHref}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/25 bg-white/15 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/25"
            title="View Details"
          >
            <Eye className="h-3 w-3" />
            View
          </Link>
          <Link
            href={followupHref}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/25 bg-white/15 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/25"
            title="Add TL Follow-up"
          >
            <Edit className="h-3 w-3" />
            Add TL Follow-up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TLCustomerFollowUpCards({ customers, basePath, queryString }) {
  const qs = queryString ? `?${queryString}` : "";

  return (
    <section className="border-b border-gray-200 bg-slate-50/80 px-6 py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">TL follow-up</h2>
        {customers.length > 0 ? (
          <span className="text-xs font-medium text-slate-500">{customers.length} on this page (filtered)</span>
        ) : null}
      </div>

      <div
        className="mb-4 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 sm:px-4"
        role="list"
        aria-label="Card colours by next follow-up date"
      >
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">
          Card colours (by next follow-up date)
        </span>
        {NEXT_FOLLOWUP_DATE_TRAFFIC_LEGEND.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-2 text-[11px] text-slate-700 sm:text-xs"
            role="listitem"
          >
            <span
              className={`h-2.5 w-9 shrink-0 rounded-full shadow-sm ring-1 ring-black/5 ${item.dotClass}`}
              aria-hidden
            />
            <span>
              <span className="font-semibold text-slate-800">{item.title}</span>
              <span className="text-slate-600"> — {item.caption}</span>
            </span>
          </span>
        ))}
      </div>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/90 bg-white/60 px-4 py-8 text-center">
          <p className="text-sm text-slate-600">No TL entries match the current filters.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto pb-2 pt-0.5 [scrollbar-gutter:stable]">
          <div className="flex min-w-0 flex-row flex-nowrap gap-4 sm:gap-5">
            {customers.map((c) => (
              <TLCustomerFollowUpCard
                key={c.customer_id}
                customer={c}
                detailHref={`${basePath}/${c.customer_id}${qs}`}
                followupHref={`${basePath}/${c.customer_id}/followup${qs}`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
