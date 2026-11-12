"use client";

import {
  getCompletionImageSrc,
  parseCompletionImageList,
} from "./serviceCompletionImageUtils";

function PhotoGrid({ title, paths }) {
  if (!paths.length) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
        No {title.toLowerCase()} uploaded.
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {paths.map((filePath, index) => {
          const src = getCompletionImageSrc(filePath);
          const label = filePath.split("/").pop() || `Photo ${index + 1}`;
          return (
            <a
              key={`${filePath}-${index}`}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-md border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={src}
                  alt={`${title} ${index + 1}`}
                  className="max-h-full max-w-full object-contain group-hover:scale-[1.02] transition-transform"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = "";
                    e.currentTarget.alt = "Failed to load";
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-600 px-2 py-1 truncate" title={label}>
                {label}
              </p>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default function ServiceCompletionPhotosPanel({
  preCompletion,
  afterCompletion,
  serviceId,
  serialNumber,
}) {
  const preImages = parseCompletionImageList(preCompletion);
  const postImages = parseCompletionImageList(afterCompletion);

  if (!preImages.length && !postImages.length) {
    return null;
  }

  return (
    <section className="mt-6 p-4 border border-gray-200 rounded-lg bg-white no-print">
      <h3 className="text-lg font-semibold text-gray-900 text-center">
        Service photos
      </h3>
      <p className="text-xs text-center text-gray-500 mb-4">
        Service ID: {serviceId}
        {serialNumber ? ` | Serial: ${serialNumber}` : ""}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PhotoGrid title="Pre-completion" paths={preImages} />
        <PhotoGrid title="Post-completion" paths={postImages} />
      </div>
    </section>
  );
}
