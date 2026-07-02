"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Calendar, MapPin, Truck, FileText, Package, Download } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function DeliveryChallanViewPage() {
  const params = useParams();
  const id = params.id;
  const router = useRouter();
  const [challan, setChallan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const challanRef = useRef(null);

  useEffect(() => {
    const fetchChallan = async () => {
      try {
        const response = await fetch(`/api/admin/delivery-challan/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch delivery challan");
        }
        const data = await response.json();
        setChallan(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchChallan();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !challan) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-600 font-semibold">{error || "Delivery Challan not found"}</p>
        <Link href="/admin-dashboard/delivery-challan" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to Delivery Challans
        </Link>
      </div>
    );
  }

  const handleDownloadPDF = async () => {
    if (!challanRef.current) return;
    setDownloading(true);
    try {
      // Delay to ensure all images (including signature) are fully loaded
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const element = challanRef.current;
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        onclone: (clonedDoc) => {
          // Fix for "lab" or "oklch" color error in html2canvas
          const allElements = clonedDoc.getElementsByTagName("*");
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const style = window.getComputedStyle(el);
            
            // Check and fix common color properties
            ["color", "backgroundColor", "borderColor", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor"].forEach(prop => {
              const val = style[prop];
              if (val && (val.includes("oklch") || val.includes("lab"))) {
                // Force a safe color if unsupported format detected
                if (prop === "color") el.style[prop] = "#000000";
                else if (prop.includes("border")) el.style[prop] = "#9ca3af";
                else el.style[prop] = "transparent";
              }
            });
          }
        }
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const margin = 10; // 10mm margin on all sides
      const imgWidth = 210 - (margin * 2); // A4 width minus margins
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Delivery_Challan_${challan.challan_no || id}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      // Fallback for user if capture fails
      alert("PDF generation failed. You can still use Ctrl+P and 'Save as PDF' as a temporary workaround.");
    } finally {
      setDownloading(false);
    }
  };

  let transportationDetails = {};
  try {
    transportationDetails = JSON.parse(challan.transportation_details || "{}");
  } catch (e) {
    console.error("Error parsing transportation details", e);
  }

  const {
    transporter_name: transporterName,
    transporter_gstin: transporterGstin,
    lr_no: lrNo,
    mode: transportationMode,
    vehicle_no: vehicleNumber,
    driver_name: driverName,
    driver_contact: driverContact,
    expected_delivery_date: expectedDeliveryDate,
  } = transportationDetails || {};

  const totalQuantity = challan.items?.reduce((sum, item) => sum + (item.product_quantity || 0), 0) || 0;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <Link
            href="/admin-dashboard/delivery-challan"
            className="p-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition-all"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-700">Delivery Challan Details</h1>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all disabled:bg-blue-400"
        >
          <Download size={20} />
          {downloading ? "Downloading..." : "Download PDF"}
        </button>
      </div>

      <div className="bg-[#ffffff] p-0 space-y-0 shadow-none">
        <div ref={challanRef} className="max-w-[1000px] mx-auto p-0 shadow-none flex flex-col bg-[#ffffff]">
          {/* Main Title */}
          <div className="text-center py-2 bg-[#ffffff]">
            <h2 className="text-xl font-bold text-[#000000] uppercase tracking-tight">Delivery Challan</h2>
          </div>

          {/* Content with border */}
          <div className="border border-[#9ca3af]">
            {/* Header Section */}
          <div className="flex border-b border-[#9ca3af] bg-[#ffffff]">
            <div className="w-1/3 p-6 flex items-center justify-center bg-[#ffffff]">
              <img src="/logo.png" alt="Dynaclean Logo" className="max-h-20 w-auto object-contain" />
            </div>
            <div className="w-2/3 p-6 text-right bg-[#ffffff]">
              <h1 className="text-2xl font-bold text-[#000000] mb-1">Dynaclean Industries Pvt Ltd</h1>
              <p className="text-[11px] font-bold text-[#000000] leading-tight">1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,</p>
              <p className="text-[11px] font-bold text-[#000000] leading-tight">Gandhi Nagar, Ganapathy, Coimbatore, Coimbatore, Tamil Nadu,</p>
              <p className="text-[11px] font-bold text-[#000000] leading-tight">641006</p>
              <p className="text-[11px] font-bold text-[#000000] mt-1 leading-tight">Phone no.: 9220454360 Email: sales@dynacleanindustries.com</p>
              <p className="text-[11px] font-bold text-[#000000] leading-tight">GSTIN: 07AAKCD6495M1ZV, State: 33- Tamil Nadu</p>
            </div>
          </div>

          {/* Info Section - 4 Columns */}
          <div className="grid grid-cols-4 border-b border-[#9ca3af] text-[11px] bg-[#ffffff]">
            <div className="border-r border-[#9ca3af] p-3 bg-[#ffffff]">
              <h3 className="font-bold mb-1 border-b border-[#e5e7eb] pb-0.5 text-[#000000]">Delivery Challan For</h3>
              <p className="font-bold text-[#000000] leading-snug whitespace-pre-wrap">{challan.delivery_challan_for || "-"}</p>
              {challan.delivery_challan_for_address && (
                <p className="text-[#000000] leading-snug whitespace-pre-wrap mt-1">{challan.delivery_challan_for_address}</p>
              )}
              {challan.delivery_challan_for_gstin && (
                <p className="text-[#000000] leading-snug whitespace-pre-wrap mt-1">GSTIN: {challan.delivery_challan_for_gstin}</p>
              )}
            </div>
            <div className="border-r border-[#9ca3af] p-3 bg-[#ffffff]">
              <h3 className="font-bold mb-1 border-b border-[#e5e7eb] pb-0.5 text-[#000000]">Ship To</h3>
              <p className="font-bold text-[#000000] leading-snug whitespace-pre-wrap">{challan.ship_to || "-"}</p>
              {challan.ship_to_address && (
                <p className="text-[#000000] leading-snug whitespace-pre-wrap mt-1">{challan.ship_to_address}</p>
              )}
              {challan.ship_to_gstin && (
                <p className="text-[#000000] leading-snug whitespace-pre-wrap mt-1">GSTIN: {challan.ship_to_gstin}</p>
              )}
            </div>
            <div className="border-r border-[#9ca3af] p-3 bg-[#ffffff]">
              <h3 className="font-bold mb-1 border-b border-[#e5e7eb] pb-0.5 text-[#000000]">Transportation Details</h3>
              <div className="space-y-1 mt-1 text-[#000000]">
                <p><span className="font-medium">Transporter Name:</span> {transporterName || "-"}</p>
                <p><span className="font-medium">Transporter GSTIN:</span> {transporterGstin || "-"}</p>
                <p><span className="font-medium">Mode of Transport:</span> {transportationMode ? transportationMode.toString().toUpperCase() : "-"}</p>
                <p><span className="font-medium">Vehicle No:</span> {vehicleNumber || "-"}</p>
                <p><span className="font-medium">Driver Name:</span> {driverName || "-"}</p>
                <p><span className="font-medium">Driver Contact:</span> {driverContact || "-"}</p>
                <p><span className="font-medium">LR/Bilty No.:</span> {lrNo || "-"}</p>
                <p><span className="font-medium">Expected Delivery Date:</span> {expectedDeliveryDate ? new Date(expectedDeliveryDate).toLocaleDateString("en-GB") : "-"}</p>
                <p><span className="font-medium">Delivery Date:</span> {challan.delivery_date ? new Date(challan.delivery_date).toLocaleDateString("en-GB") : "-"}</p>
                <p className="leading-tight"><span className="font-medium">Delivery Location:</span> {challan.delivery_location || "-"}</p>
              </div>
            </div>
            <div className="p-3 text-right bg-[#ffffff]">
              <h3 className="font-bold mb-1 border-b border-[#e5e7eb] pb-0.5 text-[#000000]">Challan Details</h3>
              <div className="space-y-1 mt-1 text-[#000000]">
                <p><span className="font-medium">Challan No. :</span> {challan.challan_no || "-"}</p>
                <p><span className="font-medium">Date :</span> {challan.challan_date ? new Date(challan.challan_date).toLocaleDateString("en-GB") : "-"}</p>
              </div>
            </div>
          </div>

          {/* E-way Bill Section */}
          <div className="border-b border-[#9ca3af] p-3 text-[11px] bg-[#ffffff]">
            <p><span className="font-bold text-[#000000]">E-way Bill:</span> <span className="text-[#000000]">{challan.eway_bill || "-"}</span></p>
          </div>

          {/* Items Table */}
          <div className="w-full overflow-hidden border-b border-[#9ca3af] bg-[#ffffff]">
            <table className="w-full text-[11px] border-collapse bg-[#ffffff]">
              <thead>
                <tr className="border-b border-[#9ca3af] bg-[#f9fafb]">
                  <th className="border-r border-[#9ca3af] p-1.5 w-8 text-center text-[#000000]">#</th>
                  <th className="border-r border-[#9ca3af] p-1.5 text-left text-[#000000]">Item name</th>
                  <th className="border-r border-[#9ca3af] p-1.5 w-32 text-center text-[#000000]">Item Code</th>
                  <th className="border-r border-[#9ca3af] p-1.5 w-24 text-center text-[#000000]">HSN/ SAC</th>
                  <th className="border-r border-[#9ca3af] p-1.5 w-20 text-center text-[#000000]">Quantity</th>
                  <th className="p-1.5 w-16 text-center text-[#000000]">Unit</th>
                </tr>
              </thead>
              <tbody>
                {challan.items && challan.items.length > 0 ? (
                  challan.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[#e5e7eb] last:border-b-0 bg-[#ffffff]">
                      <td className="border-r border-[#9ca3af] p-2 text-center align-top text-[#000000]">{idx + 1}</td>
                      <td className="border-r border-[#9ca3af] p-2 align-top">
                        <p className="font-bold text-[#000000] uppercase mb-0.5">{item.product_name}</p>
                        {item.product_specification && (
                          <p className="text-[10px] text-[#374151] leading-tight font-bold">({item.product_specification})</p>
                        )}
                      </td>
                      <td className="border-r border-[#9ca3af] p-2 text-center align-top text-[#000000]">{item.product_code || "-"}</td>
                      <td className="border-r border-[#9ca3af] p-2 text-center align-top text-[#000000]">{item.product_hsn || "-"}</td>
                      <td className="border-r border-[#9ca3af] p-2 text-center align-top font-medium text-[#000000]">{item.product_quantity || 0}</td>
                      <td className="p-2 text-center align-top text-[#000000]">{item.product_unit || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="bg-[#ffffff]">
                    <td colSpan="6" className="p-4 text-center text-[#6b7280] italic">No items found</td>
                  </tr>
                )}
                {/* Total Row */}
                <tr className="border-t border-[#9ca3af] bg-[#f9fafb] font-bold">
                  <td className="border-r border-[#9ca3af] p-1.5"></td>
                  <td className="border-r border-[#9ca3af] p-1.5 text-left uppercase text-[#000000]">Total</td>
                  <td className="border-r border-[#9ca3af] p-1.5"></td>
                  <td className="border-r border-[#9ca3af] p-1.5"></td>
                  <td className="border-r border-[#9ca3af] p-1.5 text-center text-[#000000]">{totalQuantity}</td>
                  <td className="p-1.5"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Terms and Conditions */}
          <div className="p-4 border-b border-[#9ca3af] text-[11px] bg-[#ffffff]">
            <h3 className="font-bold mb-1 underline text-[#000000]">Terms and Conditions</h3>
            <div className="space-y-1 mt-2 min-h-[60px] text-[#000000]">
              <p>Thanks for doing business with us!</p>
              <p>{challan.remarks || "This is not for sale only use for Demo"}</p>
            </div>
          </div>

          {/* Footer Section - 3 Columns */}
          <div className="grid grid-cols-3 text-[11px] h-48 bg-[#ffffff]">
            <div className="border-r border-[#9ca3af] p-4 flex flex-col justify-between bg-[#ffffff]">
              <h3 className="font-bold underline text-[#000000]">Received By</h3>
              <div className="space-y-2 text-[#000000]">
                <p>Name:</p>
                <p>Comment:</p>
                <p>Date:</p>
                <p>Signature:</p>
              </div>
            </div>
            <div className="border-r border-[#9ca3af] p-4 flex flex-col justify-between bg-[#ffffff]">
              <h3 className="font-bold underline text-[#000000]">Delivered By</h3>
              <div className="space-y-2 text-[#000000]">
                <p>Name:</p>
                <p>Comment:</p>
                <p>Date:</p>
                <p>Signature:</p>
              </div>
            </div>
            <div className="p-4 flex flex-col justify-between items-center text-center bg-[#ffffff]">
              <div className="flex-1 flex items-center justify-center py-2 bg-[#ffffff]">
                {/* Signature Image */}
                <img src="/images/sign.png" alt="Signature" className="w-20 h-20 object-contain" />
              </div>
              <h3 className="font-bold text-[#000000]">Authorized Signatory</h3>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Print specific spacing */}
      <div className="h-8 print:hidden"></div>

      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          body {
            background: white !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .max-w-7xl {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .max-w-\\[1000px\\] {
            max-width: 100% !important;
            width: 100% !important;
            border: 1px solid #9ca3af !important;
          }
        }
      `}</style>
    </div>
  );
}
