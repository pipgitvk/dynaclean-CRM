"use client";

import { CheckCircle2 } from "lucide-react";
import {
  buildDelhiveryTrackingTimeline,
  formatDelhiveryTimelineDate,
} from "@/lib/delhiveryB2bTrackingUi";

const DEFAULT_ACCENT = "#3B966F";

/**
 * Delhivery milestone timeline (vertical = sales page, horizontal = order detail row).
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
          const highlight = step.highlight || isLast;
          const isDelivered =
            String(step.label).toLowerCase() === "delivered";
          const dotFilled = isDelivered && highlight;

          return (
            <li
              key={`${step.key}-${step.at}`}
              className="flex min-w-[8.5rem] flex-[1_1_0%] flex-col items-center px-1 text-center sm:min-w-[9rem] md:max-w-none lg:min-w-0"
            >
              <div className="flex w-full items-center">
                <span
                  className="h-0.5 min-w-[0.25rem] flex-1"
                  style={{
                    backgroundColor: isFirst ? "transparent" : accent,
                  }}
                  aria-hidden
                />
                <span
                  className="box-border h-4 w-4 shrink-0 rounded-full border-2 bg-white"
                  style={{
                    borderColor: accent,
                    backgroundColor: dotFilled ? accent : "#fff",
                  }}
                  aria-hidden
                />
                <span
                  className="h-0.5 min-w-[0.25rem] flex-1"
                  style={{
                    backgroundColor: isLast ? "transparent" : accent,
                  }}
                  aria-hidden
                />
              </div>
              <div className="mt-2 min-w-0 px-0.5">
                <p
                  className={`inline-flex flex-wrap items-center justify-center gap-1 text-xs font-semibold leading-snug sm:text-[13px] ${
                    highlight ? "" : "text-gray-800"
                  }`}
                  style={highlight ? { color: accent } : undefined}
                >
                  <span>{step.label}</span>
                  {isDelivered && highlight ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0"
                      strokeWidth={2.5}
                    />
                  ) : null}
                </p>
                <p className="mt-1 text-[10px] italic leading-tight text-gray-500 sm:text-[11px]">
                  {formatDelhiveryTimelineDate(step.at)}
                </p>
                {step.footnote ? (
                  <p className="mt-1 text-[10px] text-gray-500">{step.footnote}</p>
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
        const highlight = step.highlight || isLast;
        const isDelivered = String(step.label).toLowerCase() === "delivered";
        const dotFilled = isDelivered && highlight;

        return (
          <li
            key={`${step.key}-${step.at}`}
            className="relative pl-9 pb-8 last:pb-0"
          >
            {!isLast ? (
              <span
                className="absolute left-[7px] top-[1.125rem] bottom-0 w-0.5"
                style={{ backgroundColor: accent }}
                aria-hidden
              />
            ) : null}
            <span
              className="absolute left-0 top-0.5 box-border h-4 w-4 shrink-0 rounded-full border-2 bg-white"
              style={{
                borderColor: accent,
                backgroundColor: dotFilled ? accent : "#fff",
              }}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] leading-snug">
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    highlight ? "" : "text-gray-800"
                  }`}
                  style={highlight ? { color: accent } : undefined}
                >
                  {step.label}
                  {isDelivered && highlight ? (
                    <CheckCircle2
                      className="h-4 w-4"
                      style={{ color: accent }}
                      strokeWidth={2.5}
                    />
                  ) : null}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500 italic">
                  {formatDelhiveryTimelineDate(step.at)}
                </span>
              </div>
              {step.footnote ? (
                <p className="mt-1.5 text-sm text-gray-500">{step.footnote}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function delhiveryTimelineFromTrackPayload(data) {
  return buildDelhiveryTrackingTimeline(data);
}
