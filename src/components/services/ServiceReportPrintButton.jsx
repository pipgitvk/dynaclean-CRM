"use client";

import { useState } from "react";
import ServiceReportPrintModal from "./ServiceReportPrintModal";

const parseImageList = (value) =>
  value
    ? String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

export default function ServiceReportPrintButton({
  serviceId,
  dashboardPath,
  preCompletion,
  afterCompletion,
  className = "inline-block px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center",
}) {
  const [showModal, setShowModal] = useState(false);
  const [printMode, setPrintMode] = useState("withImages");

  const hasPhotos =
    parseImageList(preCompletion).length > 0 ||
    parseImageList(afterCompletion).length > 0;

  const openModal = () => {
    setPrintMode(hasPhotos ? "withImages" : "reportOnly");
    setShowModal(true);
  };

  const handleConfirm = () => {
    const mode = printMode === "withImages" ? "withImages" : "reportOnly";
    const url = `/${dashboardPath}/view-service-report/${serviceId}?showPrintModal=1&printMode=${mode}`;
    window.open(url, "_blank");
    setShowModal(false);
  };

  return (
    <>
      <button type="button" onClick={openModal} className={className}>
        Print Report
      </button>
      <ServiceReportPrintModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        printMode={printMode}
        setPrintMode={setPrintMode}
        hasPhotos={hasPhotos}
        onConfirm={handleConfirm}
      />
    </>
  );
}
