import React from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import InvoicePDFDocument from "@/components/InvoicePdf";
// import InvoicePDFDocument from "./InvoicePDFDocument";

const DownloadPDFButton = ({ invoiceData }) => {
  return (
    <PDFDownloadLink
      document={<InvoicePDFDocument data={invoiceData} />}
      fileName={`Invoice-${invoiceData.invoice.number.replace(/[/\\]/g, "_")}.pdf`}
      style={{
        display: "inline-block",
        padding: "10px 20px",
        backgroundColor: "#2196F3",
        color: "white",
        textDecoration: "none",
        borderRadius: "4px",
        border: "none",
        cursor: "pointer",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {({ loading }) => (loading ? "Preparing PDF..." : "Download PDF")}
    </PDFDownloadLink>
  );
};

export default DownloadPDFButton;