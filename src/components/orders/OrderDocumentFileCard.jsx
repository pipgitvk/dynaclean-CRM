"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { resolveStoredFileUrl } from "@/lib/resolveStoredFileUrl";
import {
  canEditOrderDocumentField,
  getMaxFilesForField,
  getOrderDocumentEditBlockReason,
} from "@/lib/orderDocumentEditRules";

function getDisplayUrl(fileUrl) {
  if (!fileUrl) return "";
  if (fileUrl.includes("res.cloudinary.com")) {
    return `/api/cloudinary-proxy?url=${encodeURIComponent(fileUrl)}`;
  }
  return resolveStoredFileUrl(fileUrl);
}

function fileLabelFromUrl(fileUrl, index) {
  const segment = fileUrl.split("/").pop() || "";
  const decoded = decodeURIComponent(segment.split("?")[0]);
  return decoded || `File ${index + 1}`;
}

export default function OrderDocumentFileCard({
  label,
  fieldKey,
  file,
  orderId,
  order,
  onUploaded,
}) {
  const [uploading, setUploading] = useState(false);
  const canEdit = canEditOrderDocumentField(order, fieldKey);
  const blockReason = getOrderDocumentEditBlockReason(order, fieldKey);
  const maxFiles = getMaxFilesForField(fieldKey);

  const fileUrls = useMemo(
    () =>
      String(file || "")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean),
    [file],
  );

  const atMax = fileUrls.length >= maxFiles;

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (!selected.length || uploading || !canEdit) return;

    const remaining = maxFiles - fileUrls.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxFiles} files allowed per field`);
      return;
    }

    const toUpload = selected.slice(0, remaining);
    if (selected.length > remaining) {
      toast.error(`Only ${remaining} more file(s) allowed`);
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("field", fieldKey);
      toUpload.forEach((f) => formData.append("files", f));

      const res = await fetch(`/api/orders/${orderId}/files`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Upload failed");
      }

      onUploaded?.(fieldKey, result.value);
      toast.success(`${result.added} file(s) uploaded`);
    } catch (error) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h4 className="text-sm font-semibold mb-2">{label}</h4>
      {fileUrls.length === 0 ? (
        <p className="text-gray-500 text-xs mb-2">Not uploaded</p>
      ) : fileUrls.length === 1 ? (
        <div className="flex gap-2">
          <a
            href={getDisplayUrl(fileUrls[0])}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm"
          >
            View
          </a>
          <a
            href={getDisplayUrl(fileUrls[0])}
            download
            className="text-green-600 hover:underline text-sm"
          >
            Download
          </a>
        </div>
      ) : (
        <details className="cursor-pointer">
          <summary className="text-blue-600 underline hover:text-blue-800 text-sm">
            {fileUrls.length} files
          </summary>
          <div className="mt-2 space-y-2 rounded border border-gray-200 bg-gray-50 p-2">
            {fileUrls.map((fileUrl, idx) => {
              const displayUrl = getDisplayUrl(fileUrl);
              return (
                <div
                  key={`${fileUrl}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded bg-white p-2 text-sm"
                >
                  <span className="truncate flex-1">
                    {idx + 1}. {fileLabelFromUrl(fileUrl, idx)}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View
                    </a>
                    <a
                      href={displayUrl}
                      download
                      className="text-green-600 hover:underline text-xs"
                    >
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {canEdit && !atMax && (
        <div className="mt-3 border-t pt-3">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple={maxFiles > 1}
            disabled={uploading}
            onChange={handleFileSelect}
            className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 disabled:opacity-50"
          />
          {maxFiles > 1 && (
            <p className="mt-1 text-xs text-gray-500">
              Up to {maxFiles} files ({fileUrls.length}/{maxFiles})
            </p>
          )}
          {uploading && (
            <p className="mt-1 text-xs text-blue-600">Uploading...</p>
          )}
        </div>
      )}

      {!canEdit && blockReason && (
        <p className="mt-2 text-xs text-amber-700">{blockReason}</p>
      )}
    </div>
  );
}
