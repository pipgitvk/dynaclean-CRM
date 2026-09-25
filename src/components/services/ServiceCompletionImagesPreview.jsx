"use client";

import { useState } from "react";
import {
  getCompletionImageSrc,
  parseCompletionImageList,
} from "./serviceCompletionImageUtils";

function HoverPreviewImage({ src, alt }) {
  const [preview, setPreview] = useState(null);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className="h-8 w-8 shrink-0 cursor-zoom-in rounded border border-gray-200 bg-white object-cover transition-transform duration-200 hover:scale-105"
        loading="lazy"
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPreview({
            src,
            alt,
            x: rect.left + rect.width / 2,
            y: rect.top,
          });
        }}
        onMouseLeave={() => setPreview(null)}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {preview && (
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{
            left: preview.x,
            top: preview.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <img
            src={preview.src}
            alt={preview.alt}
            className="max-h-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border-2 border-white bg-white object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}

function ImageGroup({ label, images }) {
  if (!images.length) return null;
  return (
    <div className="mt-1.5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {images.map((filePath, index) => (
          <HoverPreviewImage
            key={`${label}-${filePath}-${index}`}
            src={getCompletionImageSrc(filePath)}
            alt={`${label} image ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function ServiceCompletionImagesPreview({
  preCompletion,
  afterCompletion,
}) {
  const preImages = parseCompletionImageList(preCompletion);
  const postImages = parseCompletionImageList(afterCompletion);

  if (!preImages.length && !postImages.length) {
    return null;
  }

  return (
    <div className="mt-2 min-w-[100px]">
      <ImageGroup label="Pre" images={preImages} />
      <ImageGroup label="Post" images={postImages} />
    </div>
  );
}
