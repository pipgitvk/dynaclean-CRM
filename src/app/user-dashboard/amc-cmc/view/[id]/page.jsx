"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import toast from "react-hot-toast";

export default function ViewUserAMCCMCPage() {
  const params = useParams();
  const id = params.id;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/amc-cmc/${id}`);
        if (!res.ok) throw new Error("Failed to fetch record");
        const data = await res.json();
        setRecord(data);
      } catch (error) {
        toast.error("Failed to fetch record details");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchRecord();
  }, [id]);

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":  return "bg-yellow-100 text-yellow-800";
      case "approved": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "expired":  return "bg-gray-100 text-gray-800";
      default:         return "bg-gray-100 text-gray-800";
    }
  };

  // Cloudinary URLs pass through as-is; local filenames get /uploads/ prefix
  const getFileUrl = (filePath) => {
    if (!filePath) return "";
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
    return `/uploads/${filePath}`;
  };

  // Cloudinary → proxy; other URLs → direct; local → /uploads/
  const handleViewFile = (fileUrl) => {
    if (!fileUrl) return;
    if (fileUrl.includes("res.cloudinary.com")) {
      window.open(`/api/cloudinary-proxy?url=${encodeURIComponent(fileUrl)}`, "_blank");
      return;
    }
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      window.open(fileUrl, "_blank");
      return;
    }
    window.open(`/uploads/${fileUrl}`, "_blank");
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-300 rounded w-1/3"></div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-300 rounded w-2/3"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-red-600">Record not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        href="/user-dashboard/amc-cmc"
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeft size={18} />
        Back to My Requests
      </Link>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">AMC/CMC Request Details</h1>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(record.status)}`}>
            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
          </span>
        </div>

        <div className="space-y-6">
          {/* Product Information */}
          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Product Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Serial Number</p>
                <p className="text-lg font-semibold">{record.serial_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Model</p>
                <p className="text-lg font-semibold">{record.model || "—"}</p>
              </div>
              {record.image_at_the_time_of_amc && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600 mb-2">Image</p>
                  <div className="flex items-start gap-3">
                    <img
                      src={getFileUrl(record.image_at_the_time_of_amc)}
                      alt="AMC Image"
                      className="max-w-xs rounded-lg"
                    />
                    <button
                      onClick={() => handleViewFile(record.image_at_the_time_of_amc)}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors whitespace-nowrap"
                      title="View full image"
                    >
                      <Eye size={16} />
                      View
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Company Information */}
          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Company Name</p>
                <p className="text-lg font-semibold">{record.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Contact</p>
                <p className="text-lg font-semibold">{record.contact || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-lg font-semibold">{record.email || "—"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">Site Address</p>
                <p className="text-lg">{record.site_address || "—"}</p>
              </div>
            </div>
          </section>

          {/* Site Contact Information */}
          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Site Contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Site Contact</p>
                <p className="text-lg font-semibold">{record.site_contact || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Site Email</p>
                <p className="text-lg font-semibold">{record.site_email || "—"}</p>
              </div>
            </div>
          </section>

          {/* AMC Period */}
          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">AMC Period</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Start Date</p>
                <p className="text-lg font-semibold">
                  {new Date(record.amc_start_datetime).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">End Date</p>
                <p className="text-lg font-semibold">
                  {new Date(record.amc_end_datetime).toLocaleString()}
                </p>
              </div>
            </div>
          </section>

          {/* Documentation */}
          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Documentation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Quotation Reference</p>
                <p className="text-lg font-semibold">{record.quotation_ref || "—"}</p>
              </div>
              {record.invoice && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Invoice</p>
                  <button
                    onClick={() => handleViewFile(record.invoice)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
                  >
                    <Eye size={16} />
                    View Invoice
                  </button>
                </div>
              )}
              {record.payment_proof && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Payment Proof</p>
                  <button
                    onClick={() => handleViewFile(record.payment_proof)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
                  >
                    <Eye size={16} />
                    View Payment Proof
                  </button>
                </div>
              )}
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">Terms and Conditions</p>
                <p className="text-lg whitespace-pre-wrap">{record.terms_and_conditions || "—"}</p>
              </div>
            </div>
          </section>

          {/* Metadata */}
          <section className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-3">Request Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Submitted By</p>
                <p className="font-semibold">{record.created_by || "—"}</p>
              </div>
              <div>
                <p className="text-gray-600">Submitted On</p>
                <p className="font-semibold">{new Date(record.created_time).toLocaleString()}</p>
              </div>
              {record.approved_by && (
                <div>
                  <p className="text-gray-600">Approved By</p>
                  <p className="font-semibold">{record.approved_by}</p>
                </div>
              )}
              {record.approved_time && (
                <div>
                  <p className="text-gray-600">Approved On</p>
                  <p className="font-semibold">{new Date(record.approved_time).toLocaleString()}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6">
          <Link
            href="/user-dashboard/amc-cmc"
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg"
          >
            Back to Requests
          </Link>
        </div>
      </div>
    </div>
  );
}
