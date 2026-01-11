"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InstallationUploadModal({ serviceId }) {
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const router = useRouter(); // ✅ Move this OUT of the handler

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("installationFile", file);
    formData.append("service_id", serviceId); // ✅ Must be sent!

    const res = await fetch("/api/upload-installation", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    setUploading(false);

    if (result.success) {
      setMessage(`Uploaded: ${result.fileName}`);
      setShowModal(false);
      router.push("/user-dashboard/view_service_reports"); // ✅ Redirect
    } else {
      setMessage(`Error: ${result.message}`);
    }
  };

  return (
    <div>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-indigo-600 text-white rounded"
      >
        Upload Installation Report
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center  bg-opacity-40">
          <div className="bg-white p-6 rounded shadow-md w-full max-w-md relative">
            <h2 className="text-xl font-semibold mb-4">Upload Installation</h2>
            <form onSubmit={handleUpload}>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setFile(e.target.files[0])}
                required
                className="mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
            {message && (
              <p className="mt-4 text-sm text-green-600">{message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
