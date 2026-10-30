"use client";

import { CheckCircle2 } from "lucide-react";
import {
  formatDelhiveryTimelineDate,
} from "@/lib/delhiveryB2bTrackingUi";

const DEFAULT_ACCENT = "#3B966F";
const PENDING_DOT = "#D1D5DB";
const PENDING_LINE = "#E5E7EB";
const PENDING_TEXT = "#9CA3AF";

function stepState(step) {
  if (step.state === "completed" || step.state === "active" || step.state === "pending") {
    return step.state;
  }
  return "pending";
}

function milestoneDotFilled(step, state) {
  if (state === "completed") return true;
  if (step.key === "delivered" && state === "active" && step.at) return true;
  return false;
}

function showDeliveredCheck(step, state) {
  return step.key === "delivered" && state === "active" && Boolean(step.at);
}

/**
 * Delhivery milestone timeline (vertical = mobile, horizontal = order detail row).
 * Always four steps: Picked Up → On the Way → Out for Delivery → Delivered.
 */
export default function DelhiveryTrackingTimeline({
  steps = [],
  layout = "vertical",
  className = "",
  accentColor = DEFAULT_ACCENT,
}) {
  const accent = accentColor || DEFAULT_ACCENT;

  if (!steps.length) {
    return (
      <p className="text-center text-sm text-gray-500">
        No tracking milestones available.
      </p>
    );
  }

  if (layout === "horizontal") {
    return (
      <ol
        className={`flex w-full min-w-0 list-none flex-row items-start gap-0 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory [scrollbar-width:thin] md:overflow-visible md:snap-none md:pb-0 ${className}`}
      >
        {steps.map((step, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === steps.length - 1;
          const state = stepState(step);
          const dotFilled = milestoneDotFilled(step, state);
          const leftLine =
            isFirst ? "transparent" : stepState(steps[idx - 1]) === "completed"
              ? accent
              : PENDING_LINE;
          const rightLine = isLast
            ? "transparent"
            : state === "completed"
              ? accent
              : PENDING_LINE;
          const titleColor =
            state === "pending"
              ? PENDING_TEXT
              : state === "active"
                ? accent
                : "#1F2937";

          return (
            <li
              key={step.key || `${step.label}-${idx}`}
              className="flex min-w-[8.5rem] flex-[1_1_0%] flex-col items-center px-1 text-center sm:min-w-[9rem] md:max-w-none lg:min-w-0"
            >
              <div className="flex w-full items-center">
                <span
                  className="h-0.5 min-w-[0.25rem] flex-1"
                  style={{
                    backgroundColor: leftLine,
                  }}
                  aria-hidden
                />
                <span
                  className={`box-border h-4 w-4 shrink-0 rounded-full border-2 ${
                    state === "active" && !dotFilled ? "ring-2 ring-offset-1" : ""
                  }`}
                  style={{
                    borderColor: state === "pending" ? PENDING_DOT : accent,
                    backgroundColor: dotFilled ? accent : "#fff",
                    ...(state === "active" && !dotFilled
                      ? { ringColor: `${accent}55` }
                      : {}),
                  }}
                  aria-hidden
                />
                <span
                  className="h-0.5 min-w-[0.25rem] flex-1"
                  style={{
                    backgroundColor: rightLine,
                  }}
                  aria-hidden
                />
              </div>
              <div className="mt-2 min-w-0 px-0.5">
                <p
                  className="inline-flex flex-wrap items-center justify-center gap-1 text-xs font-semibold leading-snug sm:text-[13px]"
                  style={{ color: titleColor }}
                >
                  <span>{step.label}</span>
                  {showDeliveredCheck(step, state) ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0"
                      strokeWidth={2.5}
                    />
                  ) : null}
                </p>
                {step.at ? (
                  <p className="mt-1 text-[10px] italic leading-tight text-gray-500 sm:text-[11px]">
                    {formatDelhiveryTimelineDate(step.at)}
                  </p>
                ) : null}
                {step.footnote ? (
                  <p className="mt-1 text-[10px] text-gray-600">{step.footnote}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ul className={`list-none ${className}`}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const state = stepState(step);
        const dotFilled = milestoneDotFilled(step, state);
        const lineColor = state === "completed" ? accent : PENDING_LINE;
        const titleColor =
          state === "pending"
            ? PENDING_TEXT
            : state === "active"
              ? "#1E3A5F"
              : "#1F2937";

        return (
          <li
            key={step.key || `${step.label}-${idx}`}
            className="relative pl-9 pb-8 last:pb-0"
          >
            {!isLast ? (
              <span
                className="absolute left-[7px] top-[1.125rem] bottom-0 w-0.5"
                style={{ backgroundColor: lineColor }}
                aria-hidden
              />
            ) : null}
            <span
              className={`absolute left-0 top-0.5 box-border h-4 w-4 shrink-0 rounded-full border-2 ${
                state === "active" && !dotFilled ? "ring-2 ring-offset-1" : ""
              }`}
              style={{
                borderColor: state === "pending" ? PENDING_DOT : accent,
                backgroundColor: dotFilled ? accent : "#fff",
                ...(state === "active" && !dotFilled
                  ? { ringColor: `${accent}55` }
                  : {}),
              }}
              aria-hidden
            />
            <div className="min-w-0">
              {state === "pending" ? (
                <p
                  className="text-[15px] font-semibold leading-snug"
                  style={{ color: titleColor }}
                >
                  {step.label}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] leading-snug">
                    <span
                      className="inline-flex items-center gap-1.5 font-semibold"
                      style={{ color: titleColor }}
                    >
                      {step.label}
                      {showDeliveredCheck(step, state) ? (
                        <CheckCircle2
                          className="h-4 w-4"
                          style={{ color: accent }}
                          strokeWidth={2.5}
                        />
                      ) : null}
                    </span>
                    {step.at ? (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500 italic">
                          {formatDelhiveryTimelineDate(step.at)}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {step.footnote ? (
                    <p className="mt-1.5 text-sm text-gray-600">{step.footnote}</p>
                  ) : null}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { buildDelhiveryTrackingTimeline as delhiveryTimelineFromTrackPayload } from "@/lib/delhiveryB2bTrackingUi";
