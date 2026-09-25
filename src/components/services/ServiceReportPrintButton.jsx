"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import ServiceReportPrintModal from "./ServiceReportPrintModal";

const parseImageList = (value) =>
  value
    ? String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

const formatReportDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return String(value);
};

export default function ServiceReportPrintButton({
  serviceId,
  reportId,
  reportDate,
  dashboardPath,
  preCompletion,
  afterCompletion,
  onRecordImagesUpdated,
  className = "inline-block px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center",
  label = "Print Report",
  variant = "button",
  title = "Print Report",
}) {
  const [showModal, setShowModal] = useState(false);
  const [printMode, setPrintMode] = useState("withImages");
  const [preImages, setPreImages] = useState(preCompletion || "");
  const [afterImages, setAfterImages] = useState(afterCompletion || "");

  useEffect(() => {
    setPreImages(preCompletion || "");
    setAfterImages(afterCompletion || "");
  }, [preCompletion, afterCompletion]);

  const hasPhotos =
    parseImageList(preImages).length > 0 ||
    parseImageList(afterImages).length > 0;

  const openModal = () => {
    setPrintMode(hasPhotos ? "withImages" : "reportOnly");
    setShowModal(true);
  };

  const handleImagesUpdated = (pre, after) => {
    setPreImages(pre);
    setAfterImages(after);
    if (parseImageList(pre).length > 0 || parseImageList(after).length > 0) {
      setPrintMode("withImages");
    }
    onRecordImagesUpdated?.(pre, after);
  };

  const handleConfirm = () => {
    const params = new URLSearchParams();
    if (reportId) params.set("reportId", String(reportId));
    const query = params.toString();
    const url = `/${dashboardPath}/view-service-report/${serviceId}${
      query ? `?${query}` : ""
    }`;
    window.open(url, "_blank");
    setShowModal(false);
  };

  const linkClassName =
    "text-blue-600 hover:underline font-medium cursor-pointer bg-transparent border-0 p-0 text-sm";
  const iconClassName =
    className ||
    "inline-flex items-center justify-center p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title={variant === "icon" ? title : undefined}
        className={
          variant === "link"
            ? linkClassName
            : variant === "icon"
              ? iconClassName
              : className
        }
      >
        {variant === "icon" ? <Printer className="w-4 h-4" /> : label}
      </button>
      <ServiceReportPrintModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        printMode={printMode}
        setPrintMode={setPrintMode}
        hasPhotos={hasPhotos}
        onConfirm={handleConfirm}
        reportId={reportId}
        reportDate={formatReportDate(reportDate)}
        serviceId={serviceId}
        preCompletion={preImages}
        afterCompletion={afterImages}
        onImagesUpdated={handleImagesUpdated}
      />
    </>
  );
}
