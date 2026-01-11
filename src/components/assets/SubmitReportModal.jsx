// src/app/components/assets/modals/SubmitReportModal.jsx
"use client";

import { useState } from "react";

export default function SubmitReportModal({ asset, onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/assets/${asset.asset_id}/report-pdf`);
      if (!response.ok) {
        throw new Error("Failed to generate PDF.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `asset-report-${asset.asset_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("An error occurred while downloading the PDF.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please upload the completed report PDF.");
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append("action", "upload-submit-report");
    formData.append("submit_report", file);

    try {
      const response = await fetch(`/api/assets/${asset.asset_id}`, {
        method: "PATCH",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to submit report.");
      }
      alert("Report submitted successfully!");
      onClose();
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-xl font-bold mb-4 text-gray-800">
        Submit Asset Report
      </h3>
      <div className="space-y-4">
        <div>
          <p className="mb-2">
            First, download the pre-filled report template. Fill it out, sign
            it, and then upload it below.
          </p>
          <button
            onClick={handleDownload}
            className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Download Report Template
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Upload Completed Report
            </label>
            <input
              type="file"
              name="submit_report"
              accept=".pdf"
              onChange={handleFileChange}
              className="mt-1 p-2 w-full border rounded-md"
              required
            />
          </div>
          <button
            type="submit"
            className={`w-full p-2 rounded-md text-white ${
              file && !loading
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            disabled={!file || loading}
          >
            {loading ? "Submitting..." : "Confirm Submission"}
          </button>
        </form>
      </div>
    </div>
  );
}
