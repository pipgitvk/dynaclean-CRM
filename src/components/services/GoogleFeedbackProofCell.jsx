"use client";

import { useState } from "react";
import ServiceAttachmentLink from "./ServiceAttachmentLink";
import { getCompletionImageSrc } from "./serviceCompletionImageUtils";

function isImageFile(name) {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(String(name || ""));
}

function ProofThumbnail({ src, alt }) {
  const [preview, setPreview] = useState(null);

  return (
    <>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
        title="Open Google feedback proof"
      >
        <img
          src={src}
          alt={alt}
          className="h-12 w-12 shrink-0 cursor-zoom-in rounded border border-gray-200 bg-white object-cover"
          loading="lazy"
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const showBelow = rect.top < 220;
            setPreview({
              src,
              alt,
              x: rect.left + rect.width / 2,
              y: showBelow ? rect.bottom + 8 : rect.top - 8,
              showBelow,
            });
          }}
          onMouseLeave={() => setPreview(null)}
          onError={(e) => {
            e.currentTarget.classList.add("hidden");
          }}
        />
      </a>
      {preview ? (
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{
            left: preview.x,
            top: preview.y,
            transform: preview.showBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          <img
            src={preview.src}
            alt={preview.alt}
            className="max-h-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border-2 border-white bg-white object-contain shadow-2xl"
          />
        </div>
      ) : null}
    </>
  );
}

export default function GoogleFeedbackProofCell({
  record,
  /** Open Installation: always show Yes / No / Null (do not hide empty). */
  showNullState = false,
}) {
  const serviceType = String(record?.service_type || "").trim().toUpperCase();
  const proof = String(record?.google_feedback_proof || "").trim();
  const rawCollected = record?.google_feedback_collected;
  const collectedLoaded = rawCollected !== undefined && rawCollected !== null;
  const collected = String(rawCollected || "")
    .trim()
    .toLowerCase();
  const yes = collected === "yes";
  const no = collected === "no";

  if (
    !showNullState &&
    serviceType !== "INSTALLATION" &&
    serviceType !== "COMPLAINT" &&
    !proof &&
    !collected
  ) {
    return <span className="text-gray-400">—</span>;
  }

  if (!showNullState && !collected && !proof) {
    return <span className="text-gray-400">—</span>;
  }

  if (showNullState && !collectedLoaded && !proof) {
    return <span className="text-gray-400">—</span>;
  }

  const label = yes ? "Yes" : no ? "No" : "Null";
  const badgeClass = yes
    ? "bg-emerald-100 text-emerald-800"
    : no
      ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-500";

  return (
    <div className="min-w-[5.5rem] space-y-1">
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
      >
        {label}
      </span>
      {proof ? (
        isImageFile(proof) ? (
          <ProofThumbnail
            src={getCompletionImageSrc(proof)}
            alt="Google feedback upload"
          />
        ) : (
          <ServiceAttachmentLink
            filePath={proof}
            fileName="Google feedback"
            className="text-xs text-blue-600 hover:underline"
          />
        )
      ) : yes ? (
        <span className="text-xs text-amber-600">Missing file</span>
      ) : null}
    </div>
  );
}