"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Eye } from "lucide-react";
import toast from "react-hot-toast";

export default function ViewAMCCMCPage() {
  const params = useParams();
  const router = useRouter();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serialNumber, setSerialNumber] = useState(null);

  useEffect(() => {
    if (params?.id) {
      setSerialNumber(params.id);
    }
  }, [params]);

  useEffect(() => {
    if (!serialNumber) return;

    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/amc-cmc/${serialNumber}`);
        if (!res.ok) throw new Error("Failed to fetch record");

        const data = await res.json();
        setRecord(data);
      } catch (error) {
        toast.error("Failed to load record");
        router.push("/admin-dashboard/amc-cmc");
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [serialNumber, router]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!record) {
    return <div className="p-6">Record not found</div>;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "expired":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  const handleViewFile = (fileUrl) => {
    if (!fileUrl) return;
    // Cloudinary image URL → proxy
    if (fileUrl.includes("res.cloudinary.com")) {
      window.open(`/api/cloudinary-proxy?url=${encodeURIComponent(fileUrl)}`, "_blank");
      return;
    }
    // Already absolute URL
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      window.open(fileUrl, "_blank");
      return;
    }
    // Local path (e.g. /amc_cmc/file.pdf) → open directly
    const cleanPath = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
    window.open(cleanPath, "_blank");
  };

  // Returns correct URL for display (img src etc.)
  const getFileUrl = (filePath) => {
    if (!filePath) return "";
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
    return filePath.startsWith("/") ? filePath : `/${filePath}`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        href="/admin-dashboard/amc-cmc"
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeft size={18} />
        Back to AMC/CMC
      </Link>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">AMC/CMC Record</h1>
            <p className="text-gray-600 mt-1">Serial: {record.serial_number}</p>
          </div>
          <span
            className={`px-4 py-2 rounded-full font-semibold ${getStatusColor(
              record.status
            )}`}
          >
            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Information */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Product Information</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Serial Number</label>
                <p className="text-gray-800">{record.serial_number}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Model</label>
                <p className="text-gray-800">{record.model || "—"}</p>
              </div>
              {record.image_at_the_time_of_amc && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Image</label>
                  <div className="mt-1 flex items-center gap-2">
                    <img
                      src={getFileUrl(record.image_at_the_time_of_amc)}
                      alt="AMC Image"
                      className="w-full rounded-lg max-h-48 object-cover"
                    />
                    <button
                      onClick={() => handleViewFile(record.image_at_the_time_of_amc)}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors whitespace-nowrap h-fit"
                      title="View image in full screen"
                    >
                      <Eye size={18} />
                      View
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Company Information */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Company Information</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Company Name</label>
                <p className="text-gray-800">{record.company_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Contact</label>
                <p className="text-gray-800">{record.contact || "—"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-gray-800">
                  {record.email ? (
                    <a href={`mailto:${record.email}`} className="text-blue-600 hover:underline">
                      {record.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              {record.site_address && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Site Address</label>
                  <p className="text-gray-800">{record.site_address}</p>
                </div>
              )}
            </div>
          </section>

          {/* Site Contact */}
          <section>
            <h2 className="text-lg font-semibold mb-4">Site Contact</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Contact Person</label>
                <p className="text-gray-800">{record.site_contact || "—"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-gray-800">
                  {record.site_email ? (
                    <a href={`mailto:${record.site_email}`} className="text-blue-600 hover:underline">
                      {record.site_email}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* AMC Period */}
          <section>
            <h2 className="text-lg font-semibold mb-4">AMC Period</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Start Date</label>
                <p className="text-gray-800">
                  {new Date(record.amc_start_datetime).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">End Date</label>
                <p className="text-gray-800">
                  {new Date(record.amc_end_datetime).toLocaleString()}
                </p>
              </div>
            </div>
          </section>

          {/* Documentation */}
          <section className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Documentation</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {record.quotation_ref && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Quotation Ref</label>
                  <p className="text-gray-800">{record.quotation_ref}</p>
                </div>
              )}
              {record.invoice && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Invoice</label>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => handleViewFile(record.invoice)}
                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      title="View invoice"
                    >
                      <Eye size={16} />
                      View
                    </button>
                    <a
                      href={getFileUrl(record.invoice)}
                      download
                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      title="Download invoice"
                    >
                      <Download size={16} />
                      Download
                    </a>
                  </div>
                </div>
              )}
              {record.payment_proof && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Payment Proof</label>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => handleViewFile(record.payment_proof)}
                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      title="View payment proof"
                    >
                      <Eye size={16} />
                      View
                    </button>
                    <a
                      href={getFileUrl(record.payment_proof)}
                      download
                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      title="Download payment proof"
                    >
                      <Download size={16} />
                      Download
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Approval Information */}
          {record.approved_by && (
            <section className="md:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Approval Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Approved By</label>
                  <p className="text-gray-800">{record.approved_by}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Approved Date</label>
                  <p className="text-gray-800">
                    {new Date(record.approved_time).toLocaleString()}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Terms and Conditions */}
          {record.terms_and_conditions && (
            <section className="md:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Terms and Conditions</h2>
              <p className="text-gray-800 whitespace-pre-wrap">{record.terms_and_conditions}</p>
            </section>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8 pt-6 border-t">
          <Link
            href={`/admin-dashboard/amc-cmc/edit/${record.id}`}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg"
          >
            Edit
          </Link>
          <Link
            href="/admin-dashboard/amc-cmc"
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
