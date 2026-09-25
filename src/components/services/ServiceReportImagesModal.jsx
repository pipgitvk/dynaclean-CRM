"use client";

import { useRef, useState } from "react";
import {
  getCompletionImageSrc,
  parseCompletionImageList,
} from "./serviceCompletionImageUtils";

function ImageSection({
  title,
  images,
  uploading,
  onAdd,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <button
          type="button"
          onClick={onAdd}
          disabled={uploading}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-blue-400 text-xl font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          title={`Add ${title.toLowerCase()} image`}
        >
          +
        </button>
      </div>
      {images.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((image, index) => (
            <a
              key={`${image}-${index}`}
              href={getCompletionImageSrc(image)}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-md border border-gray-200 bg-gray-50"
            >
              <img
                src={getCompletionImageSrc(image)}
                alt={`${title} ${index + 1}`}
                className="h-24 w-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No images added yet.</p>
      )}
    </div>
  );
}

export default function ServiceReportImagesModal({
  isOpen,
  onClose,
  serviceId,
  preCompletion,
  afterCompletion,
  onImagesUpdated,
}) {
  const preInputRef = useRef(null);
  const postInputRef = useRef(null);
  const [uploadingType, setUploadingType] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const preImages = parseCompletionImageList(preCompletion);
  const postImages = parseCompletionImageList(afterCompletion);

  const uploadImages = async (type, fileList) => {
    if (!serviceId || !fileList?.length) return;

    setUploadingType(type);
    setError("");

    try {
      const formData = new FormData();
      formData.append("type", type);
      Array.from(fileList).forEach((file) => {
        formData.append("images", file);
      });

      const res = await fetch(
        `/api/service-records/${serviceId}/completion-images`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload images");
      }

      onImagesUpdated?.(data.pre_completion || "", data.after_completion || "");
    } catch (uploadError) {
      setError(uploadError.message || "Failed to upload images");
    } finally {
      setUploadingType("");
    }
  };

  const handleFileChange = async (type, event) => {
    const files = event.target.files;
    await uploadImages(type, files);
    event.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 no-print">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-images-title"
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <h3
            id="service-images-title"
            className="text-lg font-semibold text-gray-900"
          >
            Pre & Post Images
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          <ImageSection
            title="Pre"
            images={preImages}
            uploading={uploadingType === "pre"}
            onAdd={() => preInputRef.current?.click()}
          />
          <ImageSection
            title="Post"
            images={postImages}
            uploading={uploadingType === "post"}
            onAdd={() => postInputRef.current?.click()}
          />
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : null}
        {uploadingType ? (
          <p className="mt-4 text-sm text-blue-600">Uploading images...</p>
        ) : null}

        <input
          ref={preInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => handleFileChange("pre", event)}
        />
        <input
          ref={postInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => handleFileChange("post", event)}
        />

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
