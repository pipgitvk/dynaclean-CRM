"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { CalendarDays, MapPin, Phone } from "lucide-react";
import {
  FOLLOWUP_CARD_RGB,
  getFollowupCardBackgroundColor,
  getFollowupDateUrgency,
} from "@/utils/followupDateColors";
import { isModuleKeyAllowed } from "@/lib/moduleAccess";
import ManualPaymentFollowupModal from "./ManualPaymentFollowupModal";
import ManualPaymentHistoryModal from "./ManualPaymentHistoryModal";

const LEGEND = [
  { color: FOLLOWUP_CARD_RGB.overdue, label: "Overdue" },
  { color: FOLLOWUP_CARD_RGB.due_soon, label: "Due Soon (≤2h)" },
  { color: FOLLOWUP_CARD_RGB.upcoming, label: "Upcoming (2–12h)" },
  { color: FOLLOWUP_CARD_RGB.far, label: "Far Upcoming (>12h)" },
];

function SkeletonCard() {
  return (
    <div className="h-[280px] w-[260px] shrink-0 animate-pulse rounded-xl bg-gray-200" />
  );
}

function rowToPayment(row) {
  return {
    id: row.payment_id,
    customer_name: row.customer_name || row.payment_customer_name || null,
    customer_phone: row.customer_phone || null,
    amount: row.amount,
  };
}

function PaymentFollowupCard({ row, dashboardPrefix, onFollowClick, onHistoryClick }) {
  const bgColor = getFollowupCardBackgroundColor(row.next_followup_date);
  const urgency = getFollowupDateUrgency(row.next_followup_date);
  const displayName =
    row.customer_name || row.payment_customer_name || "Customer";
  const amountLabel =
    row.amount != null
      ? `₹${Number(row.amount).toLocaleString("en-IN")}`
      : "Amount not set";
  const dueLabel = row.next_followup_date
    ? dayjs(row.next_followup_date).format("DD MMM, YYYY hh:mm A")
    : "Not set";
  const editHref = `${dashboardPrefix}/manual-payments/edit/${row.payment_id}`;

  return (
    <div
      className="flex min-h-[280px] w-[260px] shrink-0 flex-col justify-between rounded-xl p-4 text-white shadow-md transition duration-200 hover:shadow-lg hover:brightness-95"
      style={{ backgroundColor: bgColor }}
    >
      <div>
        <h3 className="mb-2 line-clamp-1 text-sm font-bold uppercase tracking-wide text-white">
          {displayName}
        </h3>

        <div className="mb-1 flex items-center gap-2 text-xs text-white/90">
          <Phone size={13} className="shrink-0 text-white/70" />
          <span className="truncate">{row.customer_phone || "—"}</span>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs text-white/90">
          <MapPin size={13} className="shrink-0 text-white/70" />
          <span className="truncate">Payment #{row.payment_id}</span>
        </div>

        {row.notes && (
          <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-white/90">
            {row.notes}
          </p>
        )}

        <p className="mb-3 line-clamp-2 text-xs font-semibold text-white">
          {amountLabel}
        </p>

        <div className="mt-2 space-y-1.5 text-xs text-white/90">
          <div className="flex items-center gap-2">
            <CalendarDays size={13} className="shrink-0 text-white/70" />
            <span>{dueLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-300" />
            <span className="truncate capitalize">
              {row.payment_status || "pending"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-200" />
            <span className="truncate">{urgency.label}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-white/25 pt-3">
        <Link
          href={editHref}
          className="text-xs font-semibold text-white transition hover:text-white/70"
        >
          View
        </Link>
        <button
          type="button"
          onClick={() => onFollowClick(row)}
          className="text-xs font-semibold text-white transition hover:text-white/70"
        >
          Follow
        </button>
        <button
          type="button"
          onClick={() => onHistoryClick(row)}
          className="text-xs font-semibold text-white transition hover:text-white/70"
        >
          History
        </button>
      </div>
    </div>
  );
}

export default function ManualPaymentUpcomingFollowups({
  dashboardPrefix = "/accounts-dashboard",
}) {
  const [allowed, setAllowed] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const scrollRef = useRef(null);

  const loadFollowups = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/manual-payment-pending/followups/upcoming");
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to load follow-ups");
      }
      setFollowups(data.followups || []);
    } catch (e) {
      setError(e?.message || "Failed to load follow-ups");
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        setCheckingAccess(true);
        const res = await fetch("/api/my-modules", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setAllowed(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAllowed(isModuleKeyAllowed("manual-payments", data.allowedModules));
        }
      } catch {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    }

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    loadFollowups();
  }, [allowed, loadFollowups]);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction * 280,
      behavior: "smooth",
    });
  };

  const handleFollowClick = (row) => {
    setSelectedPayment(rowToPayment(row));
    setFollowupModalOpen(true);
  };

  const handleHistoryClick = (row) => {
    setSelectedPayment(rowToPayment(row));
    setHistoryModalOpen(true);
  };

  if (checkingAccess || !allowed) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 md:text-xl">
            Manual Payment Follow-ups
            {!loading && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({followups.length})
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Next follow-up dates you set on manual payment entries
          </p>
        </div>
        <Link
          href={`${dashboardPrefix}/manual-payments`}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          View All Payments
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
        {LEGEND.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto py-2">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : followups.length === 0 ? (
        <div className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No upcoming manual payment follow-ups. Add one from Manual Payments →
          Followup.
        </div>
      ) : (
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="absolute left-0 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition hover:bg-gray-50"
            aria-label="Scroll left"
          >
            ‹
          </button>

          <div
            ref={scrollRef}
            className="hide-scrollbar w-full overflow-x-auto py-2"
            style={{ scrollBehavior: "smooth" }}
          >
            <div className="flex flex-row flex-nowrap gap-4 px-4">
              {followups.map((row) => (
                <PaymentFollowupCard
                  key={row.id}
                  row={row}
                  dashboardPrefix={dashboardPrefix}
                  onFollowClick={handleFollowClick}
                  onHistoryClick={handleHistoryClick}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => scroll(1)}
            className="absolute right-0 z-10 flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition hover:bg-gray-50"
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      )}

      <ManualPaymentFollowupModal
        open={followupModalOpen}
        payment={selectedPayment}
        onClose={() => {
          setFollowupModalOpen(false);
          setSelectedPayment(null);
        }}
        onSaved={() => {
          setFollowupModalOpen(false);
          setSelectedPayment(null);
          loadFollowups();
        }}
      />

      <ManualPaymentHistoryModal
        open={historyModalOpen}
        payment={selectedPayment}
        onClose={() => {
          setHistoryModalOpen(false);
          setSelectedPayment(null);
        }}
      />
    </div>
  );
}
