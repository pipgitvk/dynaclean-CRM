"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  CloudUpload,
  CreditCard,
  FileImage,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { attachmentHrefForUi, splitAttachmentList } from "@/lib/attachmentPathUtils";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic)$/i;

const EXPENSE_STATUS_LABELS = {
  travel: "Travel",
  food: "Food",
  hotel: "Hotel",
  other: "Other",
};

export function formatExpenseStatusLabel(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "-";
  return EXPENSE_STATUS_LABELS[key] || raw;
}

export function ExpenseStatusBadge({ status }) {
  const label = formatExpenseStatusLabel(status);
  if (label === "-") return <span className="text-slate-400">-</span>;
  const key = String(status || "").trim().toLowerCase();
  const tone =
    key === "travel"
      ? "bg-sky-50 text-sky-800 ring-sky-200/80"
      : key === "food"
        ? "bg-amber-50 text-amber-800 ring-amber-200/80"
        : key === "hotel"
          ? "bg-indigo-50 text-indigo-800 ring-indigo-200/80"
          : "bg-slate-100 text-slate-700 ring-slate-200/80";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}
    >
      {label}
    </span>
  );
}

function formatMeetingFieldValue(raw) {
  if (raw === null || raw === undefined) {
    return <span className="text-slate-400">-</span>;
  }
  const text = String(raw).trim();
  if (!text) {
    return <span className="text-slate-400">-</span>;
  }
  return text;
}

export function ExpenseMeetingPersonCell({ personName, personContact, designation }) {
  const fields = [
    { label: "Meeting Person", value: personName },
    { label: "Person Contact", value: personContact },
    { label: "Designation", value: designation },
  ];

  return (
    <div className="flex min-w-[9rem] max-w-[14rem] flex-col gap-1 text-xs sm:text-sm">
      {fields.map(({ label, value }) => (
        <div key={label} className="min-w-0 leading-snug">
          <span className="font-semibold text-violet-800/90">{label}:</span>{" "}
          <span
            className={`break-words text-slate-800 ${
              label === "Person Contact" ? "tabular-nums" : ""
            }`}
          >
            {formatMeetingFieldValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ExpenseAmountApprovalCell({
  expAmount,
  approvedAmount,
  approvedBy,
  rejectionRemark,
}) {
  const fields = [
    {
      label: "Exp Amount",
      value: expAmount,
      labelClass: "text-red-700",
      valueClass: "font-semibold tabular-nums text-red-600",
    },
    {
      label: "Approved Amt",
      value: approvedAmount,
      labelClass: "text-emerald-700",
      valueClass: "font-semibold tabular-nums text-emerald-900",
    },
    {
      label: "Approved By",
      value: approvedBy,
      labelClass: "text-violet-700",
      valueClass: "text-violet-900",
    },
  ];

  const remark = String(rejectionRemark || "").trim();
  if (remark) {
    fields.push({
      label: "Reject Remark",
      value: remark,
      labelClass: "text-rose-700",
      valueClass: "text-rose-900",
    });
  }

  return (
    <div className="flex min-w-[9rem] max-w-[13rem] flex-col gap-1 text-xs sm:text-sm">
      {fields.map(({ label, value, labelClass, valueClass }) => (
        <div key={label} className="min-w-0 leading-snug">
          <span className={`font-semibold ${labelClass}`}>{label}:</span>{" "}
          <span className={`break-words ${valueClass}`}>{formatMeetingFieldValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ExpenseTravelDetailsCell({ travelFrom, travelTo, travelMode }) {
  const fields = [
    {
      label: "Travel From",
      value: travelFrom,
      labelClass: "text-emerald-700",
      valueClass: "text-emerald-900",
    },
    {
      label: "Travel To",
      value: travelTo,
      labelClass: "text-sky-700",
      valueClass: "text-sky-900",
    },
    {
      label: "Travel Mode",
      value: travelMode,
      labelClass: "text-amber-700",
      valueClass: "text-amber-900 font-medium",
    },
  ];

  return (
    <div className="flex min-w-[9rem] max-w-[14rem] flex-col gap-1 text-xs sm:text-sm">
      {fields.map(({ label, value, labelClass, valueClass }) => (
        <div key={label} className="min-w-0 leading-snug">
          <span className={`font-semibold ${labelClass}`}>{label}:</span>{" "}
          <span className={`break-words ${valueClass}`}>{formatMeetingFieldValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

export function parseExpenseLinkedStatementIds(raw) {
  try {
    if (raw == null || raw === "") return [];
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function ExpenseLinkedStatementsCell({
  linkedStatementIdsRaw,
  statementBasePath = "/admin-dashboard",
  variant = "default",
}) {
  const ids = parseExpenseLinkedStatementIds(linkedStatementIdsRaw);
  if (!ids.length) {
    return <span className="text-slate-400">-</span>;
  }

  const chipClass =
    variant === "sbi"
      ? "inline-flex rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-violet-900 ring-1 ring-violet-200/90 transition hover:bg-violet-100"
      : "inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-700 hover:bg-slate-200";

  return (
    <div
      className={
        variant === "sbi"
          ? "flex min-w-[8.5rem] flex-col gap-1.5"
          : undefined
      }
    >
      {variant === "sbi" ? (
        <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700/90">
          {ids.length} statement{ids.length === 1 ? "" : "s"}
        </span>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => (
          <Link
            key={id}
            href={`${statementBasePath}/statements/${id}`}
            className={chipClass}
            title={`Open statement #${id}`}
          >
            #{id}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ExpenseRowImageAttachments({ attachmentsRaw }) {
  const files = splitAttachmentList(attachmentsRaw);
  if (!files.length) {
    return <span className="text-slate-400">-</span>;
  }

  const previews = files.slice(0, 2);
  const extra = files.length - previews.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {previews.map((raw, index) => {
        const href = attachmentHrefForUi(raw);
        if (!href) return null;
        const isImage = IMAGE_EXT.test(String(raw).split("?")[0]);
        return (
          <a
            key={`${raw}-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-violet-300 hover:shadow"
            title="Open attachment"
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={href} alt="" className="h-9 w-9 object-cover" loading="lazy" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center text-violet-600">
                <FileImage className="h-4 w-4" aria-hidden />
              </span>
            )}
          </a>
        );
      })}
      {extra > 0 ? (
        <span className="text-[10px] font-semibold text-slate-500">+{extra}</span>
      ) : null}
    </div>
  );
}

const SBI_CARD_THEMES = {
  total: {
    icon: CloudUpload,
    surface: "bg-[#F0F7FF] border-blue-100/90",
    label: "text-blue-600",
    iconCircle: "bg-blue-500 shadow-blue-500/30",
    iconGlow: "bg-blue-400/25",
    activeRing: "ring-blue-400/70",
  },
  rejected: {
    icon: XCircle,
    surface: "bg-[#FEF2F2] border-rose-100/90",
    label: "text-rose-600",
    iconCircle: "bg-rose-500 shadow-rose-500/30",
    iconGlow: "bg-rose-400/25",
    activeRing: "ring-rose-400/70",
  },
  approved: {
    icon: ShieldCheck,
    surface: "bg-[#F2FAF2] border-emerald-100/90",
    label: "text-emerald-600",
    iconCircle: "bg-emerald-500 shadow-emerald-500/30",
    iconGlow: "bg-emerald-400/25",
    activeRing: "ring-emerald-400/70",
  },
  pending_approval: {
    icon: Clock,
    surface: "bg-[#FFF8ED] border-amber-100/90",
    label: "text-amber-600",
    iconCircle: "bg-amber-500 shadow-amber-500/30",
    iconGlow: "bg-amber-400/25",
    activeRing: "ring-amber-400/70",
  },
  pending_payment: {
    icon: CreditCard,
    surface: "bg-[#ECFEFF] border-cyan-100/90",
    label: "text-cyan-600",
    iconCircle: "bg-cyan-500 shadow-cyan-500/30",
    iconGlow: "bg-cyan-400/25",
    activeRing: "ring-cyan-400/70",
  },
  paid: {
    icon: CheckCircle2,
    surface: "bg-[#ECFEFF] border-teal-100/90",
    label: "text-teal-600",
    iconCircle: "bg-teal-500 shadow-teal-500/30",
    iconGlow: "bg-teal-400/25",
    activeRing: "ring-teal-400/70",
  },
};

export function ExpenseSbiSummaryCard({
  bucketId,
  label,
  amount,
  caption,
  active,
  clickable,
  onClick,
}) {
  const theme = SBI_CARD_THEMES[bucketId] || SBI_CARD_THEMES.total;
  const Icon = theme.icon;
  const displayLabel = String(label || "").toUpperCase();

  const base = `relative flex min-h-[5.5rem] items-center gap-3 rounded-2xl border p-4 text-left shadow-[0_2px_14px_-4px_rgba(15,23,42,0.08)] transition sm:gap-4 sm:p-[18px] ${theme.surface}`;
  const interactive = clickable
    ? ` cursor-pointer hover:-translate-y-px hover:shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] ${
        active ? `ring-2 ring-offset-2 ${theme.activeRing}` : ""
      }`
    : "";

  const body = (
    <>
      <div className="relative shrink-0">
        <div
          className={`absolute inset-0 scale-150 rounded-full blur-xl ${theme.iconGlow}`}
          aria-hidden
        />
        <div
          className={`relative flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md sm:h-12 sm:w-12 ${theme.iconCircle}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-bold tracking-wide sm:text-xs ${theme.label}`}>
          {displayLabel}
        </p>
        <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-[#1A1C21] sm:text-2xl">
          ₹{amount.toFixed(2)}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-slate-500 sm:text-xs">
          {caption}
        </p>
      </div>
    </>
  );

  if (clickable) {
    return (
      <button type="button" className={`${base} ${interactive} w-full`} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={base}>{body}</div>;
}

export function ExpenseApprovalStatusBadge({ status }) {
  const raw = String(status || "").trim();
  const lower = raw.toLowerCase();

  if (lower === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Approved
      </span>
    );
  }

  if (lower === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200/80">
        <XCircle className="h-3.5 w-3.5" aria-hidden />
        Rejected
      </span>
    );
  }

  if (lower === "pending" || lower === "pending approval" || !raw) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/80">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Pending approval
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/80">
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {raw}
    </span>
  );
}

export const expenseSbiFilterInputClass =
  "w-full min-w-0 rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/15 sm:w-auto";

export const expenseSbiSelectClass =
  "w-full min-w-[9.5rem] cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-slate-800 shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/15 sm:w-auto";