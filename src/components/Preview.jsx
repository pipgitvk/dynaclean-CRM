"use client";

import React from "react";
import { PDFViewer } from "@react-pdf/renderer";
import InvoicePDFDocument from "@/components/InvoicePdf";

const InvoicePDFPreview = ({ invoiceData }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "90vh",
        border: "1px solid #ccc",
      }}
    >
      <PDFViewer width="100%" height="100%" showToolbar>
        <InvoicePDFDocument data={invoiceData} />
      </PDFViewer>
    </div>
  );
};

export default InvoicePDFPreview;
