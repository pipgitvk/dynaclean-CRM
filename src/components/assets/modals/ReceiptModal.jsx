// src/app/components/assets/modals/ReceiptModal.jsx
import { jsPDF } from "jspdf";
import { useState } from "react";
import { toast } from "react-hot-toast";

export default function ReceiptModal({ asset, onClose }) {
  const [file, setFile] = useState(null);

  const generateAndDownloadReceipt = () => {
    const doc = new jsPDF();

    // Add company logo to the top of the PDF
    const logoUrl = "/images/logo.png"; // Path to your logo image
    doc.addImage(logoUrl, "PNG", 15, 10, 40, 40); // x, y, width, height

    // Set font and size
    doc.setFontSize(22);
    doc.text("Asset Assignment Receipt", 20, 60);

    doc.setFontSize(14);
    doc.text("DYNACLEAN Industries", 20, 70);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 150, 70);

    // Asset Details
    doc.setFontSize(16);
    doc.text("Asset Details", 20, 90);
    doc.setFontSize(12);
    doc.text(`Asset Name: ${asset.asset_name}`, 20, 100);
    doc.text(`Brand Name: ${asset.brand_name}`, 20, 108);
    if (asset.asset_tag_number) {
      doc.text(`Asset Tag: ${asset.asset_tag_number}`, 20, 116);
    }
    if (asset.serial_number) {
      doc.text(`Serial Number: ${asset.serial_number}`, 20, 124);
    }

    // Employee Details
    doc.setFontSize(16);
    doc.text("Employee Details", 20, 140);
    doc.setFontSize(12);
    doc.text(`Name: ${asset.Assigned_to}`, 20, 150);
    doc.text(`Assigned By: ${asset.Assigned_by}`, 20, 158);
    doc.text(
      `Assignment Date: ${new Date(asset.Assigned_Date).toLocaleDateString()}`,
      20,
      166
    );

    // Terms and Conditions
    doc.setFontSize(10);
    doc.text(
      "By signing this receipt, I acknowledge receiving the above-listed asset in the specified condition.",
      20,
      190
    );
    doc.text(
      "I agree to handle the asset with care and return it upon request or termination of employment.",
      20,
      198
    );

    // Signature placeholders
    doc.setFontSize(12);
    doc.text("Employee Signature:", 20, 220);
    doc.line(20, 230, 80, 230);
    doc.text("Admin Signature:", 120, 220);
    doc.line(120, 230, 180, 230);

    // Save the PDF with a dynamic filename based on asset
    doc.save(`Receipt_${asset.asset_tag_number || asset.asset_name}.pdf`);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("receipt", file);
    formData.append("action", "upload-receipt");

    try {
      const response = await fetch(`/api/assets/${asset.asset_id}`, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload receipt.");
      }

      toast.success("Receipt uploaded successfully!");
      onClose();
    } catch (error) {
      console.error("Error uploading receipt:", error);
      toast.error("An error occurred during upload.");
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded-lg shadow-lg space-y-6">
      <div className="flex justify-center mb-4">
        {/* Logo */}
        {/* <img src="/images/logo.png" alt="Company Logo" className="h-16" /> */}
      </div>

      <h3 className="text-2xl font-bold text-gray-900">Manage Asset Receipt</h3>

      <div className="bg-gray-50 p-4 rounded-md shadow-sm">
        <h4 className="text-xl font-semibold text-gray-800">
          Download Receipt
        </h4>
        <p className="text-gray-600 mb-4">
          You can download a blank receipt template for signing.
        </p>
        <button
          onClick={generateAndDownloadReceipt}
          className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
        >
          Download Blank Receipt (PDF)
        </button>
      </div>

      <div className="bg-gray-50 p-4 rounded-md shadow-sm">
        <h4 className="text-xl font-semibold text-gray-800">
          Upload Signed Receipt
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Upload the signed receipt document (PDF or Image) here.
        </p>
        <form onSubmit={handleUpload} className="space-y-4">
          <input
            type="file"
            onChange={handleFileChange}
            className="p-3 border rounded-md w-full text-gray-700"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 text-gray-800 p-2 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700"
            >
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
