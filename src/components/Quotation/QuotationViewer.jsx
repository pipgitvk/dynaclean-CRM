"use client";

import { useRef ,useMemo} from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Image from "next/image";

export default function QuotationViewer({ header, items }) {
  const containerRef = useRef();
  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity), 0);
    // Map payment_term_days to readable text
  const paymentTermDays = useMemo(() => {
    const map = {
      "0": "Advance",
      "9": "COD",
      "15": "15 Days",
      "30": "30 Days",
      "45": "45 Days",
      "60": "60 Days",
    };
    return map[header.payment_term_days] || header.payment_term_days || "";
  }, [header.payment_term_days]);

  // const downloadPDF = async () => {
  //   const el = containerRef.current;
  //   if (!el) return;
  
  //   // Force show large view and hide mobile view temporarily
  //   const lgViewElements = el.querySelectorAll(".lg-view");
  //   const mobileViewElements = el.querySelectorAll(".mobile-view");
  //   const originalLgDisplay = Array.from(lgViewElements).map(e => e.style.display);
  //   const originalMobileDisplay = Array.from(mobileViewElements).map(e => e.style.display);
  
  //   lgViewElements.forEach(e => (e.style.display = "block"));
  //   mobileViewElements.forEach(e => (e.style.display = "none"));
  
  //   try {
  //     const pdf = new jsPDF("p", "mm", "a4");
  //     const pdfWidth = pdf.internal.pageSize.getWidth();
  //     const pdfHeight = pdf.internal.pageSize.getHeight();
  
  //     const canvas = await html2canvas(el, {
  //       scale: 2,
  //       useCORS: true,
  //       allowTaint: true,
  //       scrollY: 0,
  //       windowWidth: el.scrollWidth,
  //       windowHeight: el.scrollHeight,
  //     });
  
  //     const imgData = canvas.toDataURL("image/png", 1.0);
  
  //     const imgProps = pdf.getImageProperties(imgData);
  //     const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
  
  //     // If content fits in one page, simple addImage
  //     if (imgHeight <= pdfHeight) {
  //       pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
  //     } else {
  //       // Split tall image into multiple page-sized chunks
  //       let position = 0;
  //       let heightLeft = imgHeight;
  
  //       const pageCanvas = document.createElement("canvas");
  //       const pageCtx = pageCanvas.getContext("2d");
  //       const pageHeightPx = (pdfHeight * canvas.height) / imgHeight; // height in px that fits one page
  //       pageCanvas.width = canvas.width;
  //       pageCanvas.height = pageHeightPx;
  
  //       let pageIndex = 0;
  //       while (heightLeft > 0) {
  //         // Clear previous
  //         pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
  //         // Copy portion from main canvas
  //         pageCtx.drawImage(
  //           canvas,
  //           0,
  //           pageIndex * pageHeightPx,
  //           canvas.width,
  //           pageHeightPx,
  //           0,
  //           0,
  //           pageCanvas.width,
  //           pageCanvas.height
  //         );
  
  //         const pageData = pageCanvas.toDataURL("image/png", 1.0);
  //         if (pageIndex > 0) pdf.addPage();
  //         pdf.addImage(pageData, "PNG", 0, 0, pdfWidth, pdfHeight);
  
  //         heightLeft -= pdfHeight;
  //         pageIndex++;
  //       }
  //     }
  
  //     pdf.save("quotation.pdf");
  //   } catch (error) {
  //     console.error("PDF generation failed:", error);
  //   } finally {
  //     // Revert to original
  //     lgViewElements.forEach((e, i) => (e.style.display = originalLgDisplay[i]));
  //     mobileViewElements.forEach((e, i) => (e.style.display = originalMobileDisplay[i]));
  //   }
  // };
  

  const downloadPDF = async () => {
    const el = containerRef.current;
    if (!el) return;

    // Temporarily force the large screen view for the PDF generation
    const lgViewElements = el.querySelectorAll(".lg-view");
    const mobileViewElements = el.querySelectorAll(".mobile-view");

    // Store original display styles to revert later
    const originalLgDisplay = Array.from(lgViewElements).map(
      (e) => e.style.display
    );
    const originalMobileDisplay = Array.from(mobileViewElements).map(
      (e) => e.style.display
    );

    // Force show the large view and hide the mobile view
    lgViewElements.forEach((e) => (e.style.display = "block"));
    mobileViewElements.forEach((e) => (e.style.display = "none"));

    // Also make sure the lg-view container is not hidden by Tailwind classes
    const lgViewContainer = el.querySelector(".lg-view");
    const originalLgClasses = lgViewContainer?.className;
    if (lgViewContainer) {
      lgViewContainer.classList.remove("hidden");
    }

    // Fix the width so the PDF looks the same on mobile / tablet / desktop
    // (approx. A4 width in pixels), and remember original inline width styles
    const originalWidth = el.style.width;
    const originalMaxWidth = el.style.maxWidth;
    el.style.width = "1123px"; // ~ A4 width at 96dpi
    el.style.maxWidth = "1123px";

    // Convert all <img> tags to base64
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
        } catch (err) {
          console.warn(
            "Failed to convert image to base64 for PDF:",
            img.src,
            err
          );
        }
      })
    );

    // Fix modern color function errors (oklch, lab, lch, etc.) for html2canvas compatibility
    el.querySelectorAll("*").forEach((e) => {
      const style = window.getComputedStyle(e);
      const color = style.color || "";
      const bg = style.backgroundColor || "";

      if (
        color.includes("oklch") ||
        color.includes("oklab") ||
        color.includes("lab(") ||
        color.includes("lch(")
      ) {
        e.style.color = "#000";
      }

      if (
        bg.includes("oklch") ||
        bg.includes("oklab") ||
        bg.includes("lab(") ||
        bg.includes("lch(")
      ) {
        e.style.backgroundColor = "#fff";
      }
    });

    // Generate PDF
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        scrollY: 0,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.7);

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Image dimensions in jsPDF units
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      // Calculate total number of pages
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight; // shift canvas for next page
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save("quotation.pdf");
    } catch (error) {
      console.error("Error during PDF generation:", error);
    } finally {
      // Revert to original display styles and Tailwind classes
      lgViewElements.forEach(
        (e, i) => (e.style.display = originalLgDisplay[i])
      );
      mobileViewElements.forEach(
        (e, i) => (e.style.display = originalMobileDisplay[i])
      );

      if (lgViewContainer && originalLgClasses !== undefined) {
        lgViewContainer.className = originalLgClasses;
      }

      // Revert width so on-screen layout goes back to normal
      el.style.width = originalWidth;
      el.style.maxWidth = originalMaxWidth;
    }
  };

  return (
    <div className="space-y-6">
      {/* Content to be captured in PDF */}
      <div
        ref={containerRef}
        className="bg-white p-4 sm:p-6 space-y-6 shadow rounded"
        style={{ color: "#000", backgroundColor: "#fff" }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border p-4 rounded bg-gray-50 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Image
              src="/images/logo.png"
              alt="Logo"
              width={100}
              height={60}
              className="object-contain"
              unoptimized
            />
            <div className="text-sm text-gray-700 break-words">
              <h2 className="text-lg font-bold text-red-600">
                Dynaclean Industries Pvt Ltd
              </h2>
              <p>
                1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,
                Gandhi Nagar, Ganapathy, Coimbatore, Coimbatore, Tamil Nadu,
                641006
              </p>
              <p>Email: sales@dynacleanindustries.com | Conatact: +91 7982456944, 011-45143666</p>
              <p>GSTIN: 07AAKCD6495M1ZV </p>
            </div>
          </div>
        </div>
        <div className="text-center">
          <span className="text-gray-800">Quotation / Proforma Invoice</span>
        </div>
        {/* Customer Info */}
        <div className="p-4 border rounded bg-gray-50 text-sm space-y-2 sm:space-y-0 sm:flex sm:justify-between">
          <div className="flex-1">
            <p>
              <strong>Name:</strong> {header.company_name}
            </p>
            <p>
              <strong>Address:</strong> {header.company_address}
            </p>
            <p>
              <strong>GST :</strong> {header.gstin}
            </p>
            <p>
              <strong>State:</strong> {header.state}
            </p>
            <p>
              <strong>Payment Term:</strong> {paymentTermDays}
            </p>
          </div>
          <div className="flex-1 text-left sm:text-right break-words mt-4 sm:mt-0">
            <p>
              <strong>Quote No:</strong> {header.quote_number}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {new Date(header.quote_date).toLocaleDateString("en-IN")}
            </p>
            <p>
              <strong>Ship To:</strong> {header.ship_to}
            </p>
            <p>
              <strong>Created By:</strong> {header.emp_name}
            </p>
          </div>
        </div>

        {/* --- ITEMS SECTION --- */}

        {/* Responsive Table for large screens (md and above) */}
        <div className="hidden md:block lg-view overflow-x-auto rounded border">
          <table className="min-w-full text-sm text-left border">
            <thead className="bg-gray-100 uppercase text-gray-700 text-xs sticky top-0 z-10">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Image</th>
                <th className="p-2">Item</th>
                <th className="p-2">Code</th>
                <th className="p-2">Specification</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Rate</th>
                <th className="p-2">Base Amount</th>
                <th className="p-2">GST</th>
                <th className="p-2">GST Amount</th>
                <th className="p-2">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b text-center">
                  <td className="p-1">{idx + 1}</td>
                  <td className="p-1">
                    {it.img_url ? (
                      <Image
                        src={it.img_url}
                        alt={it.item_name}
                        width={40}
                        height={40}
                        className="object-cover rounded mx-auto"
                        unoptimized
                      />
                    ) : (
                      <span className="text-xs text-gray-500">No image</span>
                    )}
                  </td>
                  <td className="p-1 text-left">{it.item_name}</td>
                  <td className="p-1">{it.item_code}</td>
                  <td className="p-1 text-left break-words">
                    {it.specification}
                  </td>
                  <td className="p-1">{it.quantity}</td>
                  <td className="p-1">{it.unit}</td>
                  <td className="p-1">
                    ₹{Number(it.price_per_unit).toFixed(2)}
                  </td>
                  <td className="p-1">
                    ₹{Number(it.total_taxable_amt).toFixed(2)}
                  </td>
                  <td className="p-1">{it.gst}</td>
                  <td className="p-1">{it.igsttamt}</td>
                  <td className="p-1">
                    ₹{Number(it.total_price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr className="text-center">
                <td colSpan={5} className="p-2 text-left sm:text-center">
                  Total
                </td>
                <td className="p-2">{totalQty}</td>
                <td colSpan={5} className="p-2 text-right sm:text-center">
                  ₹{header.grand_total}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Card-based layout for small screens (up to md) */}
        <div className="md:hidden mobile-view space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Items</h3>
          {items.map((it, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-4 bg-gray-50 shadow-sm space-y-2"
            >
              <div className="flex items-center gap-4">
                <span className="text-gray-500 font-bold">{idx + 1}.</span>
                {it.img_url ? (
                  <Image
                    src={it.img_url}
                    alt={it.item_name}
                    width={60}
                    height={60}
                    className="object-cover rounded-md"
                    unoptimized
                  />
                ) : (
                  <span className="text-xs text-gray-500">No image</span>
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-base">{it.item_name}</h4>
                  <p className="text-xs text-gray-600">Code: {it.item_code}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700">
                <div className="col-span-2">
                  <strong>Specification:</strong> {it.specification}
                </div>
                <div>
                  <strong>Qty:</strong> {it.quantity} {it.unit}
                </div>
                <div>
                  <strong>Rate:</strong> ₹{Number(it.price_per_unit).toFixed(2)}
                </div>
                <div>
                  <strong>Base Amount:</strong> ₹
                  {Number(it.taxable_price).toFixed(2)}
                </div>
                <div>
                  <strong>GST:</strong> {it.gst}
                </div>
                <div className="col-span-2">
                  <strong>Net Amount:</strong>{" "}
                  <span className="font-bold">
                    ₹{Number(it.total_taxable_amt).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-2 font-bold text-base bg-gray-100 rounded-lg">
            <span>Total Quantity:</span>
            <span>{totalQty}</span>
          </div>
        </div>

        {/* --- END OF ITEMS SECTION --- */}

        {/* Summary */}
        <div className="border p-4 rounded bg-gray-50 text-sm space-y-2">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
            <div className="flex-1 flex justify-between">
              <span>Sub Total:</span>
              <span>₹{header.subtotal}</span>
            </div>
            <div className="flex-1 flex justify-between font-bold text-lg text-red-600">
              <span>Grand Total:</span>
              <span>₹{header.grand_total}</span>
            </div>
          </div>
        </div>
        {/* Footer Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Terms */}
          <div className="border p-4 rounded bg-gray-50 whitespace-pre-line">
            <h4 className="font-semibold mb-1">Terms & Conditions</h4>
            <div>{header.term_con}</div>
          </div>

          {/* Bank */}
          <div className="border p-4 rounded bg-gray-50">
            <h4 className="font-semibold mb-1">Bank Details</h4>
            <p>ICICI Bank</p>
            <p>Account: 343405500379</p>
            <p>IFSC: ICIC0003434</p>
          </div>

          {/* Signatory */}
          <div className="border p-4 rounded bg-gray-50 text-center flex flex-col justify-between">
            <div>
              <p>For Dynaclean Industries Pvt Ltd</p>
              <Image
                src="/images/sign.png"
                alt="Sign"
                width={250}
                height={10}
                className="mx-auto mt-2"
                unoptimized
              />
            </div>
            <p className="mt-2 font-semibold">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* Download Button */}
      <div className="text-right">
        <button
          onClick={downloadPDF}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
