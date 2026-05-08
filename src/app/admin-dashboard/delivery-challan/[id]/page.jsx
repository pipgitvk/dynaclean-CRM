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
  const [error, setError] = useState("");

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

  const handlePrint = () => {
    window.print();
  };

  let transportationDetails = {};
  try {
    transportationDetails = JSON.parse(challan.transportation_details || "{}");
  } catch (e) {
    console.error("Error parsing transportation details", e);
  }

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
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all"
        >
          <Printer size={20} />
          Print Challan
        </button>
      </div>

      <div className="bg-white p-0 space-y-0 print:shadow-none">
        <div className="max-w-[1000px] mx-auto border border-gray-400 p-0 shadow-sm flex flex-col">
          {/* Main Title */}
          <div className="text-center py-2 border-b border-gray-400">
            <h2 className="text-xl font-bold text-black uppercase tracking-tight">Delivery Challan</h2>
          </div>

          {/* Header Section */}
          <div className="flex border-b border-gray-400">
            <div className="w-1/3 p-6 flex items-center justify-center">
              <img src="/logo.png" alt="Dynaclean Logo" className="max-h-28 w-auto object-contain" />
            </div>
            <div className="w-2/3 p-6 text-right">
              <h1 className="text-2xl font-extrabold text-black mb-1">DYNACLEAN INDUSTRIES</h1>
              <p className="text-[11px] font-bold text-black leading-tight">1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,</p>
              <p className="text-[11px] font-bold text-black leading-tight">Gandhi Nagar, Ganapathy, Coimbatore, Coimbatore, Tamil Nadu,</p>
              <p className="text-[11px] font-bold text-black leading-tight">641006</p>
              <p className="text-[11px] font-bold text-black mt-1 leading-tight">Phone no.: 9220454360 Email: sales@dynacleanindustries.com</p>
              <p className="text-[11px] font-bold text-black leading-tight">GSTIN: 33DULPK4662J1ZA, State: 33- Tamil Nadu</p>
            </div>
          </div>

          {/* Info Section - 4 Columns */}
          <div className="grid grid-cols-4 border-b border-gray-400 text-[11px]">
            <div className="border-r border-gray-400 p-3">
              <h3 className="font-bold mb-1 border-b border-gray-200 pb-0.5">Delivery Challan For</h3>
              <p className="font-bold text-black leading-snug whitespace-pre-wrap">{challan.delivery_challan_for || "-"}</p>
            </div>
            <div className="border-r border-gray-400 p-3">
              <h3 className="font-bold mb-1 border-b border-gray-200 pb-0.5">Ship To</h3>
              <p className="font-medium text-black leading-snug whitespace-pre-wrap">{challan.ship_to || "-"}</p>
            </div>
            <div className="border-r border-gray-400 p-3">
              <h3 className="font-bold mb-1 border-b border-gray-200 pb-0.5">Transportation Details</h3>
              <div className="space-y-1 mt-1">
                <p><span className="font-medium">Delivery Date:</span> {challan.delivery_date ? new Date(challan.delivery_date).toLocaleDateString("en-GB") : "-"}</p>
                <p className="leading-tight"><span className="font-medium">Delivery Location:</span> {challan.delivery_location || "-"}</p>
              </div>
            </div>
            <div className="p-3 text-right">
              <h3 className="font-bold mb-1 border-b border-gray-200 pb-0.5">Challan Details</h3>
              <div className="space-y-1 mt-1">
                <p><span className="font-medium">Challan No. :</span> {challan.challan_no || "-"}</p>
                <p><span className="font-medium">Date :</span> {challan.challan_date ? new Date(challan.challan_date).toLocaleDateString("en-GB") : "-"}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="w-full overflow-hidden border-b border-gray-400">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-gray-400 bg-gray-50">
                  <th className="border-r border-gray-400 p-1.5 w-8 text-center">#</th>
                  <th className="border-r border-gray-400 p-1.5 text-left">Item name</th>
                  <th className="border-r border-gray-400 p-1.5 w-32 text-center">Item Code</th>
                  <th className="border-r border-gray-400 p-1.5 w-24 text-center">HSN/ SAC</th>
                  <th className="border-r border-gray-400 p-1.5 w-20 text-center">Quantity</th>
                  <th className="p-1.5 w-16 text-center">Unit</th>
                </tr>
              </thead>
              <tbody>
                {challan.items && challan.items.length > 0 ? (
                  challan.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-300 last:border-b-0">
                      <td className="border-r border-gray-400 p-2 text-center align-top">{idx + 1}</td>
                      <td className="border-r border-gray-400 p-2 align-top">
                        <p className="font-bold text-black uppercase mb-0.5">{item.product_name}</p>
                        {item.product_specification && (
                          <p className="text-[10px] text-gray-700 leading-tight">({item.product_specification})</p>
                        )}
                      </td>
                      <td className="border-r border-gray-400 p-2 text-center align-top">{item.product_code || "-"}</td>
                      <td className="border-r border-gray-400 p-2 text-center align-top">{item.product_hsn || "-"}</td>
                      <td className="border-r border-gray-400 p-2 text-center align-top font-medium">{item.product_quantity || 0}</td>
                      <td className="p-2 text-center align-top">{item.product_unit || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-gray-500 italic">No items found</td>
                  </tr>
                )}
                {/* Total Row */}
                <tr className="border-t border-gray-400 bg-gray-50 font-bold">
                  <td className="border-r border-gray-400 p-1.5"></td>
                  <td className="border-r border-gray-400 p-1.5 text-left uppercase">Total</td>
                  <td className="border-r border-gray-400 p-1.5"></td>
                  <td className="border-r border-gray-400 p-1.5"></td>
                  <td className="border-r border-gray-400 p-1.5 text-center">{totalQuantity}</td>
                  <td className="p-1.5"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Terms and Conditions */}
          <div className="p-4 border-b border-gray-400 text-[11px]">
            <h3 className="font-bold mb-1 underline">Terms and Conditions</h3>
            <div className="space-y-1 mt-2 min-h-[60px]">
              <p className="text-black">Thanks for doing business with us!</p>
              <p className="text-black">{challan.remarks || "This is not for sale only use for Demo"}</p>
            </div>
          </div>

          {/* Footer Section - 3 Columns */}
          <div className="grid grid-cols-3 text-[11px] h-48">
            <div className="border-r border-gray-400 p-4 flex flex-col justify-between">
              <h3 className="font-bold underline">Received By</h3>
              <div className="space-y-2">
                <p>Name:</p>
                <p>Comment:</p>
                <p>Date:</p>
                <p>Signature:</p>
              </div>
            </div>
            <div className="border-r border-gray-400 p-4 flex flex-col justify-between">
              <h3 className="font-bold underline">Delivered By</h3>
              <div className="space-y-2">
                <p>Name:</p>
                <p>Comment:</p>
                <p>Date:</p>
                <p>Signature:</p>
              </div>
            </div>
            <div className="p-4 flex flex-col justify-between items-center text-center">
              <h3 className="font-bold w-full text-right">For : DYNACLEAN INDUSTRIES</h3>
              <div className="flex-1 flex items-center justify-center py-2">
                {/* Space for Seal/Signature */}
                <div className="w-20 h-20 border border-dashed border-gray-300 rounded-full flex items-center justify-center text-[10px] text-gray-400 print:border-none">
                  SEAL / SIGN
                </div>
              </div>
              <h3 className="font-bold">Authorized Signatory</h3>
            </div>
          </div>
        </div>

        {/* Print specific spacing */}
        <div className="h-8 print:hidden"></div>
      </div>

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
