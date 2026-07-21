"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Upload,
  FileText,
  Download,
  X,
  DollarSign,
  Calendar,
  User,
  Building2,
  ShieldCheck,
  History,
} from "lucide-react";
import toast from "react-hot-toast";

const StatusBadge = ({ status }) => {
  const styles = {
    new: "bg-blue-100 text-blue-700 border-blue-200",
    under_review: "bg-yellow-100 text-yellow-700 border-yellow-200",
    technical_preparation: "bg-purple-100 text-purple-700 border-purple-200",
    submitted: "bg-indigo-100 text-indigo-700 border-indigo-200",
    technical_qualified: "bg-teal-100 text-teal-700 border-teal-200",
    ra_participated: "bg-orange-100 text-orange-700 border-orange-200",
    won: "bg-green-100 text-green-700 border-green-200",
    lost: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
        styles[status] || "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {status.replace(/_/g, " ").toUpperCase()}
    </span>
  );
};

export default function BidDetailsPage({ params }) {
  const router = useRouter();
  const [bid, setBid] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [bidId, setBidId] = useState(null);

  const handleViewFile = (filePath) => {
    if (!filePath) return;
    if (filePath.includes('cloudinary.com')) {
      const proxyUrl = `/api/cloudinary-proxy?url=${encodeURIComponent(filePath)}`;
      window.open(proxyUrl, "_blank");
    } else {
      window.open(filePath, "_blank");
    }
  };

  useEffect(() => {
    // Handle async params in Next.js 15+
    const resolveParams = async () => {
      const resolvedParams = await params;
      setBidId(resolvedParams.bid_id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (bidId) {
      fetchBidDetails();
    }
  }, [bidId]);

  const fetchBidDetails = async () => {
    try {
      const res = await fetch(`/api/gem-crm/bids/${bidId}`);
      const result = await res.json();
      if (result.success) {
        setBid(result.data);
        setDocuments(result.documents || []);
        setLogs(result.logs || []);
      } else {
        toast.error("Failed to fetch bid details");
      }
    } catch (error) {
      console.error("Error fetching bid details:", error);
      toast.error("Error fetching bid details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this bid?")) return;

    try {
      const res = await fetch(`/api/gem-crm/bids/${bidId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Bid deleted successfully");
        router.push("/admin-dashboard/gem-crm/bids");
      } else {
        toast.error(result.error || "Failed to delete bid");
      }
    } catch (error) {
      console.error("Error deleting bid:", error);
      toast.error("Error deleting bid");
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("document", uploadFile);
    formData.append("document_name", documentName || uploadFile.name);
    formData.append("document_type", documentType);

    try {
      const res = await fetch(`/api/gem-crm/bids/${bidId}/documents`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Document uploaded successfully");
        setShowUploadModal(false);
        setUploadFile(null);
        setDocumentName("");
        setDocumentType("");
        fetchBidDetails();
      } else {
        toast.error(result.error || "Failed to upload document");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Error uploading document");
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch(`/api/gem-crm/bids/${bidId}/documents/${documentId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Document deleted successfully");
        fetchBidDetails();
      } else {
        toast.error(result.error || "Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Error deleting document");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!bid) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Bid not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin-dashboard/gem-crm/bids")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {bid.bid_title || "Bid Details"}
            </h1>
            <p className="text-gray-600 mt-1">
              {bid.bid_number && `Bid #: ${bid.bid_number}`}
              {bid.gem_bid_no && ` | GEM #: ${bid.gem_bid_no}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin-dashboard/gem-crm/bids/${bidId}/edit`)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Bid Status</p>
              <StatusBadge status={bid.bid_status} />
            </div>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Technical Status</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mt-1">
                {bid.technical_status?.toUpperCase() || "PENDING"}
              </span>
            </div>
            <ShieldCheck className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Financial Status</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mt-1">
                {bid.financial_status?.toUpperCase() || "PENDING"}
              </span>
            </div>
            <DollarSign className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Bid Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Details */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Basic Details
          </h3>
          <div className="space-y-3">
            <DetailRow label="Bidding Platform" value={bid.bidding_platform} />
            <DetailRow label="Bid Number" value={bid.bid_number} />
            <DetailRow label="GEM Bid No" value={bid.gem_bid_no} />
            <DetailRow label="Bid Title" value={bid.bid_title} />
            <DetailRow label="Item Category" value={bid.item_category} />
            <DetailRow label="Bid Type" value={bid.bid_type} />
            <DetailRow label="Evaluation Method" value={bid.evaluation_method} />
            {bid.bid_link && (
              <DetailRow
                label="Bid Link"
                value={
                  <a
                    href={bid.bid_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Link
                  </a>
                }
              />
            )}
            {bid.bid_document && (
              <DetailRow
                label="Bid Document"
                value={
                  <button
                    onClick={() => handleViewFile(bid.bid_document)}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* Dates & Values */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Dates & Values
          </h3>
          <div className="space-y-3">
            <DetailRow label="Bid Start Date" value={bid.bid_start_date} />
            <DetailRow label="Bid End Date" value={bid.bid_end_date} />
            <DetailRow label="Bid Open Date" value={bid.bid_open_date} />
            <DetailRow label="Bid Validity Days" value={bid.bid_validity_days} />
            <DetailRow
              label="Estimated Bid Value"
              value={bid.estimated_bid_value ? `₹${Number(bid.estimated_bid_value).toLocaleString()}` : "-"}
            />
            <DetailRow label="Total Quantity" value={bid.total_quantity} />
            <DetailRow label="Delivery Days" value={bid.delivery_days} />
          </div>
        </div>

        {/* Assignment */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Assignment
          </h3>
          <div className="space-y-3">
            <DetailRow label="Assigned Employee" value={bid.assigned_employee_name} />
            <DetailRow label="Created By" value={bid.created_by} />
            <DetailRow label="Created At" value={bid.created_at} />
            <DetailRow label="Updated At" value={bid.updated_at} />
          </div>
        </div>

        {/* EMD/BG */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            EMD / Bank Guarantee
          </h3>
          <div className="space-y-3">
            <DetailRow label="EMD Required" value={bid.emd_required} />
            <DetailRow
              label="EMD Amount"
              value={bid.emd_amount ? `₹${Number(bid.emd_amount).toLocaleString()}` : "-"}
            />
            <DetailRow label="EPBG Percentage" value={bid.epbg_percentage} />
            <DetailRow label="EPBG Duration (Months)" value={bid.epbg_duration_months} />
            {bid.dd_party_name && (
              <>
                <DetailRow label="Linked DD/BG Party" value={bid.dd_party_name} />
                <DetailRow
                  label="Linked DD/BG Amount"
                  value={bid.dd_amount ? `₹${Number(bid.dd_amount).toLocaleString()}` : "-"}
                />
                <DetailRow label="Linked DD/BG Status" value={bid.dd_status} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Specifications */}
      {bid.specification && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{bid.specification}</p>
        </div>
      )}

      {/* Bid Opened Details */}
      {["opened", "won", "lost", "cancelled"].includes(bid.bid_status) && (
        <div className="bg-purple-50 rounded-xl shadow-md p-6 border border-purple-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bid Opened Details</h3>
          <div className="space-y-3">
            {bid.l1_level && (
              <>
                <DetailRow label="L1 Company Name" value={bid.l1_level} />
                <DetailRow label="L1 Price" value={bid.l1_price ? `₹${Number(bid.l1_price).toLocaleString()}` : "-"} />
              </>
            )}
            {bid.l2_level && (
              <>
                <DetailRow label="L2 Company Name" value={bid.l2_level} />
                <DetailRow label="L2 Price" value={bid.l2_price ? `₹${Number(bid.l2_price).toLocaleString()}` : "-"} />
              </>
            )}
            {bid.l3_level && (
              <>
                <DetailRow label="L3 Company Name" value={bid.l3_level} />
                <DetailRow label="L3 Price" value={bid.l3_price ? `₹${Number(bid.l3_price).toLocaleString()}` : "-"} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Remarks */}
      {bid.remarks && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Remarks</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{bid.remarks}</p>
        </div>
      )}

      {/* Documents */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documents
          </h3>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>

        {documents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No documents uploaded</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.document_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{doc.document_name}</p>
                    <p className="text-xs text-gray-500">
                      {doc.document_type} • Uploaded by {doc.uploaded_by_name} •{" "}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewFile(doc.document_file)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDocument(doc.document_id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Logs */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Activity Logs
        </h3>

        {logs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No activity logs</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.log_id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {log.old_status ? `${log.old_status} → ${log.new_status}` : log.new_status}
                    </span>
                    <span className="text-xs text-gray-500">
                      by {log.updated_by_name} • {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  {log.remarks && <p className="text-sm text-gray-600 mt-1">{log.remarks}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Name
                </label>
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  <option value="technical">Technical</option>
                  <option value="financial">Financial</option>
                  <option value="commercial">Commercial</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 font-medium text-right max-w-xs truncate">
        {value || "-"}
      </span>
    </div>
  );
}
