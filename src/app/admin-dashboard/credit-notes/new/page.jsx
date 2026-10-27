"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import toast from "react-hot-toast";
import { numberToWords } from "@/utils/NumbertoWord";
import { INVOICE_LETTERHEAD } from "@/lib/invoiceLetterhead";

const fmt = (v) =>
  Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function CreditNoteNewPage() {
  const router = useRouter();
  const docRef = useRef(null);

  const [cn, setCn] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCnNumber, setSavedCnNumber] = useState("");

  // Load draft from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("creditNoteDraft");
    const returnTo =
      sessionStorage.getItem("creditNoteReturnPath") || "/admin-dashboard/order";
    if (!raw) {
      toast.error("No draft found. Please initiate a return first.");
      router.replace(returnTo);
      return;
    }
    try {
      setCn(JSON.parse(raw));
    } catch {
      toast.error("Invalid draft data.");
      router.replace(returnTo);
    }
  }, []);

  // ── Capture doc as PDF ──────────────────────────────────────────────────
  const captureAsPdf = async () => {
    const el = docRef.current;
    if (!el) throw new Error("Document element not found");

    // Convert images to base64
    const images = el.querySelectorAll("img");
    await Promise.all(
      Array.from(images).map(async (img) => {
        if (img.src.startsWith("data:")) return;
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
        } catch { /* ignore */ }
      })
    );

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      scrollY: 0,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      onclone: (_doc, clonedEl) => {
        // Inject comprehensive style override to handle all color functions
        const style = _doc.createElement("style");
        style.textContent = `
          *, *::before, *::after { 
            color: #000 !important; 
            border-color: #d1d5db !important; 
            background-color: transparent !important;
          }
          body { 
            background: #fff !important; 
          }
          .bg-white { background-color: #fff !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-blue-700 { background-color: #1d4ed8 !important; color: #fff !important; }
          .text-white { color: #fff !important; }
          .text-black { color: #000 !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
          .text-gray-700 { color: #374151 !important; }
          .text-gray-500 { color: #6b7280 !important; }
          .text-orange-500 { color: #f97316 !important; }
          .text-orange-600 { color: #ea580c !important; }
          .bg-orange-50 { background-color: #fff7ed !important; }
          .border-orange-200 { border-color: #fed7aa !important; }
          .bg-green-50 { background-color: #f0fdf4 !important; }
          .text-green-600 { color: #16a34a !important; }
          .border-green-200 { border-color: #bbf7d0 !important; }
          .bg-yellow-300 { background-color: #facc15 !important; }
          .border-gray-400 { border-color: #9ca3af !important; }
          .border-gray-300 { border-color: #d1d5db !important; }
          .border-blue-600 { border-color: #2563eb !important; }
          table { border-collapse: collapse !important; }
          td, th { border-color: #d1d5db !important; }
        `;
        _doc.head.appendChild(style);
        
        // Additional cleanup for computed styles
        clonedEl.querySelectorAll("*").forEach((node) => {
          try {
            const s = window.getComputedStyle(node);
            const bad = /oklch|oklab|lab\(|lch\(|color\(/i;
            if (bad.test(s.color)) node.style.setProperty("color", "#000", "important");
            if (bad.test(s.backgroundColor)) node.style.setProperty("background-color", "#fff", "important");
            if (bad.test(s.borderColor)) node.style.setProperty("border-color", "#d1d5db", "important");
          } catch (_) {}
        });
      },
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.85);
    const pdf = new jsPDF("l", "mm", "a4"); // "l" for landscape
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgH = (imgProps.height * pdfW) / imgProps.width;

    // Add image to fit single page - scale down if needed
    if (imgH <= pdfH) {
      // Fits on single page
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, imgH);
    } else {
      // Scale to fit single page
      const scaledH = pdfH;
      const scaledW = (imgProps.width * scaledH) / imgProps.height;
      pdf.addImage(imgData, "JPEG", (pdfW - scaledW) / 2, 0, scaledW, scaledH);
    }
    return pdf;
  };

  // ── Download & Save ─────────────────────────────────────────────────────
  const handleDownloadAndSave = async () => {
    if (!cn) return;
    setDownloading(true);
    const toastId = toast.loading("Saving to database…");
    try {
      // 1. Save to DB
      const saveRes = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cn),
      });
      const saveJson = await saveRes.json();
      if (!saveJson.success) {
        toast.error(saveJson.error || "Save failed", { id: toastId });
        return;
      }
      const cnNumber = saveJson.credit_note_number;
      setSaved(true);
      setSavedCnNumber(cnNumber);
      // Clear draft
      sessionStorage.removeItem("creditNoteDraft");
      toast.loading("Generating PDF…", { id: toastId });

      // 2. Download PDF
      const pdf = await captureAsPdf();
      pdf.save(`${cnNumber || "credit-note"}.pdf`);
      toast.success(`Saved as ${cnNumber} & downloaded!`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed: " + (err?.message || ""), { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  // ── Download only (no save) ─────────────────────────────────────────────
  const handleDownloadOnly = async () => {
    if (!cn) return;
    setDownloading(true);
    const toastId = toast.loading("Generating PDF…");
    try {
      const pdf = await captureAsPdf();
      pdf.save(`credit-note-draft.pdf`);
      toast.success("PDF downloaded (not saved to DB)", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  if (!cn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 animate-pulse">Loading…</div>
      </div>
    );
  }

  const items = Array.isArray(cn.items) ? cn.items : [];
  const taxableAmount = Number(cn.taxable_amount || 0);
  const cgstTotal = Number(cn.cgst_amount || 0);
  const sgstTotal = Number(cn.sgst_amount || 0);
  const igstTotal = Number(cn.igst_amount || 0);
  const totalTax = Number(cn.total_tax || 0);
  const grandTotal = Number(cn.grand_total || 0);
  const company = INVOICE_LETTERHEAD;

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-white border-b sticky top-0 z-10 shadow-sm flex-wrap">
        <button
          onClick={() => router.back()}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          ← Back
        </button>

        <h1 className="font-semibold text-gray-800 flex-1 min-w-0 truncate">
          Credit Note Preview
          {saved ? (
            <span className="ml-2 text-xs font-normal text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              ✓ Saved as {savedCnNumber}
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              Draft — not saved yet
            </span>
          )}
        </h1>

        <div className="flex gap-2">
          {/* Download only */}
          <button
            onClick={handleDownloadOnly}
            disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? "Generating…" : "Download PDF"}
          </button>

          {/* Download + Save */}
          <button
            onClick={handleDownloadAndSave}
            disabled={downloading || saved}
            title={saved ? "Already saved" : "Save to database and download PDF"}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {downloading ? "Processing…" : saved ? "Saved ✓" : "Download & Save"}
          </button>
        </div>
      </div>

      {/* ── Credit Note Document ──────────────────────────────────────────── */}
      <div className="flex justify-center py-8 px-4 bg-gray-100 min-h-screen">
        <div
          ref={docRef}
          className="bg-white w-full max-w-[1200px] border border-gray-400 font-sans text-[13px] text-black pb-32"
        >
          {/* Title */}
          <div className="text-center py-2 border-b border-gray-400">
            <h2 className="text-2xl font-bold text-blue-700 tracking-wide">Credit Note</h2>
          </div>

          {/* Header: 3 columns */}
          <div className="grid grid-cols-3 border-b border-gray-400 text-[12.5px]">
            <div className="border-r border-gray-400 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <Image src="/logo1.jpg" alt="Dynaclean Logo" fill className="object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
                <span className="font-bold text-base">DYNACLEAN</span>
              </div>
              <p className="font-bold text-[12px] mb-1">Credit Note From</p>
              <p className="font-semibold text-[13px] mb-1">{company.name}</p>
              <p className="text-gray-700 leading-tight text-[11.5px] mb-1">
                4th Floor, PLOT No-9, Block-B, Pocket-3, Sector-17, Dwarka., Pincode:110078
              </p>
              <p className="text-[11.5px] mb-0.5"><span className="font-semibold">GSTIN/UIN:</span> {company.gstin}</p>
              <p className="text-[11.5px]"><span className="font-semibold">Contact No.:</span> +91 9220454360</p>
            </div>

            <div className="border-r border-gray-400 p-4">
              <p className="font-bold text-[12px] mb-1">Credit Note to</p>
              <p className="font-bold text-[13px] mb-0.5">{cn.company_name || "-"}</p>
              <p className="text-gray-700 leading-tight text-[11.5px] mb-0.5">{cn.company_address || "-"}</p>
              {cn.customer_gstin && <p className="text-[11.5px]"><span className="font-semibold">GSTIN:</span> {cn.customer_gstin}</p>}
            </div>

            <div className="p-4">
              <p className="font-bold text-[12px] mb-1">Shipping to</p>
              <p className="font-semibold leading-tight text-[12px]">
                Dynaclean Industries Pvt Ltd<br />
                Plot no 1 Ranhola Road Mundka<br />
                Village Delhi 110041
              </p>
            </div>
          </div>

          {/* Credit Note Details */}
          <div className="border-b border-gray-400">
            <div className="bg-gray-200 text-center font-bold py-1.5 border-b border-gray-400 text-[13px]">
              Credit Note Details
            </div>
            <div className="grid grid-cols-2 text-[12px]">
              <div className="border-r border-b border-gray-400 px-4 py-2">
                <span className="font-semibold">Credit Note No.: </span>
                <span className="font-mono">{saved ? savedCnNumber : <span className="text-orange-600 italic">Will be assigned on save</span>}</span>
              </div>
              <div className="border-b border-gray-400 px-4 py-2">
                <span className="font-semibold">Credit Note Date: </span>
                {fmtDate(cn.credit_note_date)}
              </div>
              <div className="border-r border-b border-gray-400 px-4 py-2">
                <span className="font-semibold">Invoice No.: </span>
                {cn.invoice_no || "-"}
              </div>
              <div className="border-b border-gray-400 px-4 py-2">
                <span className="font-semibold">Invoice Date: </span>
                {fmtDate(cn.invoice_date)}
              </div>
              <div className="col-span-2 px-4 py-2">
                <span className="font-semibold">Payment Date: </span>
                {fmtDate(cn.payment_date)}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border-b border-gray-400">
            <table className="w-full text-[11.5px] border-collapse">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-2 py-2 text-center w-8 border border-gray-400">#</th>
                  <th className="px-3 py-2 text-left border border-gray-400">Description</th>
                  <th className="px-2 py-2 text-center border border-gray-400 w-24">HSN/SAC</th>
                  <th className="px-2 py-2 text-center border border-gray-400 w-16">Qty</th>
                  <th className="px-2 py-2 text-center border border-gray-400 w-12">Unit</th>
                  <th className="px-2 py-2 text-right border border-gray-400 w-20">Rate</th>
                  <th className="px-2 py-2 text-right border border-gray-400 w-24">Taxable Amt</th>
                  <th className="px-2 py-2 text-right border border-gray-400 w-20">Tax</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-gray-500 border border-gray-300">No items</td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const tax = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
                    return (
                      <tr key={idx} className="border-b border-gray-300">
                        <td className="px-2 py-2 text-center border-x border-gray-300 font-semibold">{idx + 1}</td>
                        <td className="px-3 py-2 border-r border-gray-300">
                          <span className="font-semibold block">{item.item_name || "-"}</span>
                          {item.item_code && <span className="text-gray-600 text-[11px]">{item.item_code}</span>}
                          {item.specification && <p className="text-[10.5px] text-gray-600 mt-0.5">{item.specification}</p>}
                        </td>
                        <td className="px-2 py-2 text-center border-r border-gray-300 text-[11px]">{item.hsn_sac || "-"}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-300">{item.quantity || 1}</td>
                        <td className="px-2 py-2 text-center border-r border-gray-300 text-[11px]">{item.unit || "Nos"}</td>
                        <td className="px-2 py-2 text-right border-r border-gray-300">{fmt(item.price_per_unit)}</td>
                        <td className="px-2 py-2 text-right border-r border-gray-300">{fmt(item.taxable_price)}</td>
                        <td className="px-2 py-2 text-right border-r border-gray-300">{fmt(tax)}</td>
                      </tr>
                    );
                  })
                )}
                {[...Array(Math.max(0, 3 - items.length))].map((_, i) => (
                  <tr key={`filler-${i}`} className="border-b border-gray-200">
                    <td className="px-2 py-2 border-x border-gray-200" colSpan={8}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 border-b border-gray-400 text-[11.5px]">
            <div className="border-r border-gray-400 p-4">
              <p className="mb-2"><span className="font-semibold">Taxable Amount: </span>{fmt(taxableAmount)}</p>
              <p className="font-semibold uppercase text-[11px] mt-4 leading-snug">
                {numberToWords(grandTotal)} ONLY
              </p>
            </div>
            <div className="p-4">
              <p className="font-semibold mb-2">Tax Summary:</p>
              <table className="w-full text-[11px] border-collapse mb-2">
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-2 py-1 text-center font-semibold">CGST</th>
                    <th className="border border-gray-400 px-2 py-1 text-center font-semibold">SGST</th>
                    <th className="border border-gray-400 px-2 py-1 text-center font-semibold">IGST</th>
                    <th className="border border-gray-400 px-2 py-1 text-center font-semibold">Cess</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1 text-center">{cgstTotal > 0 ? fmt(cgstTotal) : "-"}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{sgstTotal > 0 ? fmt(sgstTotal) : "-"}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{igstTotal > 0 ? fmt(igstTotal) : "-"}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">-</td>
                  </tr>
                </tbody>
              </table>
              <div className="space-y-1">
                <p className="text-[11px]"><span className="font-semibold">Total Tax: </span>{fmt(totalTax)}</p>
                <p className="text-[11px]"><span className="font-semibold">Grand Total: </span>{fmt(grandTotal)}</p>
                <div className="bg-yellow-300 px-2 py-1.5 font-bold text-[12px] border border-gray-400 mt-1">
                  Grand Total: Rs. {fmt(grandTotal)}
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Signature */}
          <div className="grid grid-cols-2 text-[11.5px]">
            <div className="border-r border-gray-400 p-4 min-h-[100px]">
              <p className="font-semibold mb-2">Terms and Conditions:</p>
              <p className="text-[10.5px] text-gray-700 leading-snug"></p>
            </div>
            <div className="p-4 flex flex-col items-end justify-between min-h-[100px]">
              <div />
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-20 mb-2">
                  <Image src="/s.png" alt="Authorized Signature" fill className="object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
                <p className="font-semibold text-[12px] border-t border-gray-400 pt-2 w-full text-center">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
