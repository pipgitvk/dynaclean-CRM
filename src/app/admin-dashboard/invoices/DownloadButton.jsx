"use client"
import React, { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import InvoicePDFDocument from "@/components/InvoicePdf";

const DownloadPDFButton = ({ invoiceData }) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const blob = await pdf(<InvoicePDFDocument data={invoiceData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice-${invoiceData.invoice.number.replace(/[/\\]/g, "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      style={{
        display: "inline-block",
        padding: "10px 20px",
        backgroundColor: loading ? "#ccc" : "#2196F3",
        color: "white",
        textDecoration: "none",
        borderRadius: "4px",
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {loading ? "Preparing PDF..." : "Download PDF"}
    </button>
  );
};

export default DownloadPDFButton;



