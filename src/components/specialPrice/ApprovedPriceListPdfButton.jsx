"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { LetterheadCompanyInfo } from "@/components/invoice/InvoiceLetterheadSection";

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹ ${n.toLocaleString("en-IN")}`;
}

export default function ApprovedPriceListPdfButton({
  customerId,
  customerName,
  rows = [],
}) {
  const containerRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const approvedItems = useMemo(
    () =>
      rows
        .filter((r) => (r.status || "").toLowerCase() === "approved")
        .map((r) => ({
          imageUrl: r.image_path || r.product_image || null,
          model: r.product_number || r.item_code || "—",
          name: r.item_name || "—",
          price: r.special_price,
        })),
    [rows],
  );

  const downloadPDF = async () => {
    const el = containerRef.current;
    if (!el || approvedItems.length === 0) return;

    setIsDownloading(true);
    const originalWidth = el.style.width;
    const originalMaxWidth = el.style.maxWidth;
    el.style.width = "1123px";
    el.style.maxWidth = "1123px";

    const images = el.querySelectorAll("img");
    await Promise.all(
      Array.from(images).map(async (img) => {
        if (!img.src || img.src.startsWith("data:")) return;
        try {
          const res = await fetch(img.src, { mode: "cors" });
          const blob = await res.blob();
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.src = base64;
        } catch (err) {
          console.warn("PDF image load failed:", img.src, err);
        }
      }),
    );

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        scrollY: 0,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
        onclone: (_doc, clonedEl) => {
          const MODERN_COLOR_RE = /\b(oklch|oklab|lab|lch|color-mix|color)\s*\(/i;
          const PROPS = [
            "color",
            "backgroundColor",
            "borderColor",
            "borderTopColor",
            "borderRightColor",
            "borderBottomColor",
            "borderLeftColor",
          ];
          clonedEl.querySelectorAll("*").forEach((node) => {
            const computed = window.getComputedStyle(node);
            PROPS.forEach((prop) => {
              const val = computed[prop] || "";
              if (MODERN_COLOR_RE.test(val)) {
                node.style[prop] =
                  prop === "backgroundColor" ? "#ffffff" : "#000000";
              }
            });
          });
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const naturalImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (naturalImgHeight <= pdfHeight) {
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, naturalImgHeight);
      } else {
        let heightLeft = naturalImgHeight;
        let position = 0;
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, naturalImgHeight);
        heightLeft -= pdfHeight;
        while (heightLeft > 0) {
          position = heightLeft - naturalImgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, naturalImgHeight);
          heightLeft -= pdfHeight;
        }
      }

      const safeName = String(customerName || "Customer")
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .toUpperCase();
      pdf.save(`APPROVED-PRICE-LIST-${customerId}-${safeName}.pdf`);
    } catch (error) {
      console.error("Approved price list PDF failed:", error);
      alert("PDF generation failed. Please try again.");
    } finally {
      el.style.width = originalWidth;
      el.style.maxWidth = originalMaxWidth;
      setIsDownloading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={downloadPDF}
        disabled={isDownloading || approvedItems.length === 0}
        className="px-4 py-2 rounded bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50"
        title={
          approvedItems.length === 0
            ? "No approved prices to export"
            : "Download approved prices as PDF"
        }
      >
        {isDownloading ? "Generating PDF…" : "Download PDF"}
      </button>

      <div
        className="fixed left-[-10000px] top-0 pointer-events-none"
        aria-hidden
      >
        <div
          ref={containerRef}
          className="bg-white p-6 space-y-5"
          style={{ color: "#000", backgroundColor: "#fff", width: "1123px" }}
        >
          <div className="flex flex-row items-center justify-between border p-4 rounded bg-gray-50 gap-4">
            <Image
              src="/images/logo.png"
              alt="Dynaclean Logo"
              width={120}
              height={80}
              className="object-contain shrink-0"
              unoptimized
            />
            <LetterheadCompanyInfo />
          </div>

          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">
              Approved Price List
            </h1>
            {customerName ? (
              <p className="text-sm text-gray-700 mt-1">
                Customer: {customerName}
                {customerId ? ` (ID: ${customerId})` : ""}
              </p>
            ) : null}
          </div>

          <table className="w-full text-sm border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-left text-xs uppercase text-gray-700">
                <th className="border border-gray-300 p-2 w-12">S.No.</th>
                <th className="border border-gray-300 p-2 w-24">Image</th>
                <th className="border border-gray-300 p-2">Model</th>
                <th className="border border-gray-300 p-2">Name</th>
                <th className="border border-gray-300 p-2 text-right w-36">
                  Approved Price
                </th>
              </tr>
            </thead>
            <tbody>
              {approvedItems.map((item, index) => (
                <tr key={`${item.model}-${index}`}>
                  <td className="border border-gray-300 p-2 align-middle">
                    {index + 1}
                  </td>
                  <td className="border border-gray-300 p-2 align-middle">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-14 h-14 object-cover rounded border border-gray-200"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">No image</span>
                    )}
                  </td>
                  <td className="border border-gray-300 p-2 align-middle">
                    {item.model}
                  </td>
                  <td className="border border-gray-300 p-2 align-middle">
                    {item.name}
                  </td>
                  <td className="border border-gray-300 p-2 align-middle text-right font-semibold">
                    {formatInr(item.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
