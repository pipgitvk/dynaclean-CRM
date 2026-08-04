"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function CreditNotePage() {
  const { id } = useParams();
  const router = useRouter();
  const docRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cn, setCn] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/credit-notes/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setCn(json.creditNote);
        } else {
          setError(json.error || "Failed to load credit note");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Shared: capture the doc element to a jsPDF ─────────────────────────
  const captureAsPdf = async () => {
    const el = docRef.current;
    if (!el) throw new Error("Document element not found");

    // Convert all <img> tags to base64 so html2canvas can render them
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
        } catch {
          // silently ignore image conversion failures
        }
      })
    );

    // Inject a style override into the cloned document BEFORE html2canvas
    // parses any element — this prevents "unsupported color function lab" errors
    const fixColors = (root) => {
      // 1. Inject a blanket <style> that overrides known Tailwind oklch tokens
      const style = root.ownerDocument.createElement("style");
      style.textContent = `
        *, *::before, *::after {
          color: inherit !important;
          background-color: inherit !important;
          border-color: #d1d5db !important;
        }
        body { color: #000 !important; background-color: #fff !important; }
      `;
      root.ownerDocument.head.appendChild(style);

      // 2. Walk every element and replace computed lab/oklch values inline
      root.ownerDocument.querySelectorAll("*").forEach((node) => {
        try {
          const s = window.getComputedStyle(node);
          const bad = /oklch|oklab|lab\(|lch\(|color\(/;
          if (bad.test(s.color)) node.style.setProperty("color", "#000000", "important");
          if (bad.test(s.backgroundColor)) node.style.setProperty("background-color", "#ffffff", "important");
          if (bad.test(s.borderColor)) node.style.setProperty("border-color", "#d1d5db", "important");
        } catch (_) {}
      });
    };

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      scrollY: 0,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      onclone: (_clonedDoc, clonedEl) => {
        fixColors(clonedEl);
      },
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.85);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgH = (imgProps.height * pdfW) / imgProps.width;

    let heightLeft = imgH;
    let pos = 0;
    pdf.addImage(imgData, "JPEG", 0, pos, pdfW, imgH);
    heightLeft -= pdfH;
    while (heightLeft > 0) {
      pos = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, pos, pdfW, imgH);
      heightLeft -= pdfH;
    }

    return pdf;
  };

  // ── Download ────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!cn) return;
    setDownloading(true);
    const toastId = toast.loading("Generating PDF…");
    try {
      const pdf = await captureAsPdf();
      pdf.save(`${cn.credit_note_number || "credit-note"}.pdf`);
      toast.success("PDF downloaded!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  // ── Save to DB ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!cn) return;
    setSaving(true);
    const toastId = toast.loading("Saving…");
    try {
      const res = await fetch(`/api/credit-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Credit note saved!", { id: toastId });
        setCn((prev) => ({ ...prev, is_saved: 1 }));
      } else {
        toast.error(json.error || "Save failed", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Save failed", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // ── Download + Save together ────────────────────────────────────────────
  const handleDownloadAndSave = async () => {
    if (!cn) return;
    setDownloading(true);
    setSaving(true);
    const toastId = toast.loading("Saving to database…");
    try {
      // 1. Save to DB first
      const saveRes = await fetch(`/api/credit-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const saveJson = await saveRes.json();
      if (!saveJson.success) {
        toast.error(saveJson.error || "Save failed", { id: toastId });
        return;
      }
      setCn((prev) => ({ ...prev, is_saved: 1 }));
      toast.loading("Generating PDF…", { id: toastId });

      // 2. Generate and download PDF
      const pdf = await captureAsPdf();
      pdf.save(`${cn.credit_note_number || "credit-note"}.pdf`);
      toast.success("Downloaded & saved!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Operation failed: " + (err?.message || ""), { id: toastId });
    } finally {
      setDownloading(false);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 text-lg animate-pulse">Loading credit note…</div>
      </div>
    );
  }

  if (error || !cn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-600 text-lg font-medium">
          {error || "Credit note not found"}
        </p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
        >
          ← Go Back
        </button>
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
  const isBusy = downloading || saving;

  return (
    <>
      {/* ── Toolbar (hidden on print) ──────────────────────────────────── */}
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-white border-b sticky top-0 z-10 shadow-sm flex-wrap">
        <button
          onClick={() => router.back()}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          ← Back
        </button>

        <h1 className="font-semibold text-gray-800 flex-1 min-w-0 truncate">
          Credit Note — {cn.credit_note_number}
          {cn.is_saved ? (
            <span className="ml-2 text-xs font-normal text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              ✓ Saved
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              Not saved
            </span>
          )}
        </h1>

        <div className="flex gap-2">
          {/* Download only */}
          <button
            onClick={handleDownload}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading && !saving ? "Generating…" : "Download PDF"}
          </button>

          {/* Download + Save together */}
          <button
            onClick={handleDownloadAndSave}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isBusy ? "Processing…" : "Download & Save"}
          </button>
        </div>
      </div>

      {/* ── Credit Note Document ───────────────────────────────────────── */}
      <div className="flex justify-center py-8 px-4 print:py-0 print:px-0 bg-gray-100 print:bg-white min-h-screen">
        <div
          ref={docRef}
          className="bg-white w-full max-w-[900px] border border-gray-400 print:border-0 print:max-w-full font-sans text-[13px] text-black"
        >
          {/* Title */}
          <div className="text-center py-2 border-b border-gray-400">
            <h2 className="text-2xl font-bold text-blue-700 tracking-wide">
              Credit Note
            </h2>
          </div>

          {/* Header: 3 columns */}
          <div className="grid grid-cols-3 border-b border-gray-400 text-[12.5px]">
            {/* Credit Note From */}
            <div className="border-r border-gray-400 p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <Image
                    src="/logo1.jpg"
                    alt="Dynaclean Logo"
                    fill
                    className="object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
                <span className="font-bold text-sm leading-tight">DYNACLEAN</span>
              </div>
              <p className="font-bold text-[12px] mb-0.5">Credit Note From</p>
              <p className="font-semibold">{company.name}</p>
              <p className="text-gray-700 leading-snug">
                4th Floor, PLOT No-9, Block-B, Pocket-3, Sector-17,<br />
                Dwarka., Pincode:110078
              </p>
              <p>GSTIN/UIN:{company.gstin}</p>
              <p>Contact No.: +91 9220454360</p>
            </div>

            {/* Credit Note To */}
            <div className="border-r border-gray-400 p-3">
              <p className="font-bold text-[12px] mb-0.5">Credit Note to</p>
              <p className="font-bold text-[13px]">{cn.company_name || "-"}</p>
              <p className="text-gray-700 leading-snug">{cn.company_address || "-"}</p>
              {cn.customer_gstin && <p>GSTIN : {cn.customer_gstin}</p>}
            </div>

            {/* Shipping To */}
            <div className="p-3">
              <p className="font-bold text-[12px] mb-0.5">Shipping to</p>
              <p className="font-semibold leading-snug">
                Dynaclean Indsutries Pvt Ltd<br />
                Plot no 1 Ranhola Road Mundka<br />
                Village Delhi 110041
              </p>
            </div>
          </div>

          {/* Credit Note Details */}
          <div className="border-b border-gray-400">
            <div className="bg-gray-100 text-center font-bold py-1 border-b border-gray-400 text-[13px]">
              Credit Note Details
            </div>
            <div className="grid grid-cols-2 text-[12.5px]">
              <div className="border-r border-b border-gray-400 px-3 py-1.5">
                <span className="font-semibold">Credit Note No.: </span>
                {cn.credit_note_number}
              </div>
              <div className="border-b border-gray-400 px-3 py-1.5">
                <span className="font-semibold">Credit Note Date: </span>
                {fmtDate(cn.credit_note_date)}
              </div>
              <div className="border-r border-b border-gray-400 px-3 py-1.5">
                <span className="font-semibold">Invoice No.: </span>
                {cn.invoice_no || "-"}
              </div>
              <div className="border-b border-gray-400 px-3 py-1.5">
                <span className="font-semibold">Invoice Date: </span>
                {fmtDate(cn.invoice_date)}
              </div>
              <div className="col-span-2 px-3 py-1.5">
                <span className="font-semibold">Payment Date: </span>
                {fmtDate(cn.payment_date)}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border-b border-gray-400">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-blue-700 text-white">
                  <th className="px-2 py-1.5 text-left w-8 border border-blue-600">#</th>
                  <th className="px-2 py-1.5 text-left border border-blue-600">Description</th>
                  <th className="px-2 py-1.5 text-center border border-blue-600 w-28">HSN/SAC Code</th>
                  <th className="px-2 py-1.5 text-center border border-blue-600 w-16">Quantity</th>
                  <th className="px-2 py-1.5 text-center border border-blue-600 w-16">Unit</th>
                  <th className="px-2 py-1.5 text-right border border-blue-600 w-24">Rate</th>
                  <th className="px-2 py-1.5 text-right border border-blue-600 w-28">Taxable Amount</th>
                  <th className="px-2 py-1.5 text-right border border-blue-600 w-24">Tax</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-gray-500 border border-gray-300">
                      No items
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const tax =
                      Number(item.cgst_amount || 0) +
                      Number(item.sgst_amount || 0) +
                      Number(item.igst_amount || 0);
                    return (
                      <tr key={idx} className="border-b border-gray-300">
                        <td className="px-2 py-1.5 text-center border-x border-gray-300">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-300">
                          <span className="font-semibold">{item.item_name || "-"}</span>
                          {item.item_code && (
                            <span className="text-gray-500 text-[11px] ml-1">
                              ({item.item_code})
                            </span>
                          )}
                          {item.specification && (
                            <p className="text-[11px] text-gray-600 leading-tight mt-0.5">
                              {item.specification}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center border-r border-gray-300">
                          {item.hsn_sac || "-"}
                        </td>
                        <td className="px-2 py-1.5 text-center border-r border-gray-300">
                          {item.quantity || 1}
                        </td>
                        <td className="px-2 py-1.5 text-center border-r border-gray-300">
                          {item.unit || "Nos"}
                        </td>
                        <td className="px-2 py-1.5 text-right border-r border-gray-300">
                          {fmt(item.price_per_unit)}
                        </td>
                        <td className="px-2 py-1.5 text-right border-r border-gray-300">
                          {fmt(item.taxable_price)}
                        </td>
                        <td className="px-2 py-1.5 text-right border-r border-gray-300">
                          {fmt(tax)}
                        </td>
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
          <div className="grid grid-cols-2 border-b border-gray-400 text-[12px]">
            {/* Left: words */}
            <div className="border-r border-gray-400 p-3">
              <p className="mb-1">
                <span className="font-semibold">Taxable Amount : </span>
                {fmt(taxableAmount)}
              </p>
              <p className="font-semibold uppercase text-[11.5px] mt-3 leading-snug">
                {numberToWords(grandTotal)} ONLY
              </p>
            </div>

            {/* Right: tax breakdown */}
            <div className="p-3">
              <p className="font-semibold mb-1">Total (before tax):</p>
              <table className="w-full text-[11.5px] border-collapse mb-1">
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-2 py-0.5 text-center">CGST</th>
                    <th className="border border-gray-400 px-2 py-0.5 text-center">SGST</th>
                    <th className="border border-gray-400 px-2 py-0.5 text-center">IGST</th>
                    <th className="border border-gray-400 px-2 py-0.5 text-center">Cess</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-400 px-2 py-0.5 text-center">
                      {cgstTotal > 0 ? fmt(cgstTotal) : "-"}
                    </td>
                    <td className="border border-gray-400 px-2 py-0.5 text-center">
                      {sgstTotal > 0 ? fmt(sgstTotal) : "-"}
                    </td>
                    <td className="border border-gray-400 px-2 py-0.5 text-center">
                      {igstTotal > 0 ? fmt(igstTotal) : "-"}
                    </td>
                    <td className="border border-gray-400 px-2 py-0.5 text-center">-</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[11.5px]">
                <span className="font-semibold">Total Tax: </span>
                {fmt(totalTax)}
              </p>
              <p className="text-[12px] mt-1">Total (after tax): {fmt(grandTotal)}</p>
              <div className="bg-yellow-300 px-2 py-1 mt-1 font-bold text-[13px]">
                Grand Total: &nbsp; Rs. {fmt(grandTotal)}
              </div>
            </div>
          </div>

          {/* Terms & Signature */}
          <div className="grid grid-cols-2 text-[12px]">
            <div className="border-r border-gray-400 p-3 min-h-[90px]">
              <p className="font-semibold mb-1">Terms and Conditions:</p>
            </div>
            <div className="p-3 flex flex-col items-end justify-between min-h-[90px]">
              <div />
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-16 mb-1">
                  <Image
                    src="/s.png"
                    alt="Authorized Signature"
                    fill
                    className="object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
                <p className="font-semibold text-[12px]">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
