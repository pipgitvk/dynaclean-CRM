import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import { Download, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OtherIncomeDetailPage({ params }) {
  const { incomeId } = params;
  
  const payload = await getSessionPayload();
  if (!payload) {
    return null;
  }

  const conn = await getDbConnection();

  const query = `
    SELECT * FROM other_income
    WHERE id = ? AND username = ?
  `;

  const [rows] = await conn.execute(query, [incomeId, payload.username]);

  if (!rows || rows.length === 0) {
    notFound();
  }

  const income = rows[0];

  const renderAttachment = (filePath, label) => {
    if (!filePath) return null;
    return (
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200">
        <span className="text-sm text-gray-700">{label}</span>
        <a
          href={filePath}
          download
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <Download size={16} />
          Download
        </a>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/accounts-dashboard/other-income" className="p-2 hover:bg-gray-100 rounded">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Other Income Details</h1>
        </div>
        <span
          className={`px-4 py-2 rounded-full font-semibold text-sm ${
            income.approval_status === "Approved"
              ? "bg-green-100 text-green-800"
              : income.approval_status === "Rejected"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {income.approval_status}
        </span>
      </div>

      <div className="space-y-6 bg-white rounded-lg shadow p-6">
        {/* Basic Information */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Income Name</p>
              <p className="text-gray-900 font-medium">{income.income_name}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Income Source</p>
              <p className="text-gray-900 font-medium">{income.income_source}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Category</p>
              <p className="text-gray-900 font-medium">{income.income_category || "-"}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Income Date</p>
              <p className="text-gray-900 font-medium">
                {dayjs(income.income_date).format("DD MMM YYYY")}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Transaction Date</p>
              <p className="text-gray-900 font-medium">
                {income.transaction_date ? dayjs(income.transaction_date).format("DD MMM YYYY") : "-"}
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded border-2 border-blue-200">
              <p className="text-xs text-blue-600 font-semibold uppercase">Amount</p>
              <p className="text-2xl font-bold text-blue-700">₹{Number(income.amount).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* GST & Tax Details */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">GST & Tax Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">GST Applicable</p>
              <p className="text-gray-900 font-medium">{income.gst_applicable || "-"}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">GST Rate</p>
              <p className="text-gray-900 font-medium">{income.gst_rate || "-"}%</p>
            </div>
            <div className="bg-green-50 p-3 rounded border-2 border-green-200">
              <p className="text-xs text-green-600 font-semibold uppercase">GST Amount</p>
              <p className="text-xl font-bold text-green-700">₹{Number(income.gst_amount || 0).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">TDS Deducted</p>
              <p className="text-gray-900 font-medium">{income.tds_deducted || "-"}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">TDS Amount</p>
              <p className="text-gray-900 font-medium">₹{Number(income.tds_amount || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Receipt & Payment Details */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Receipt & Payment Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Received From</p>
              <p className="text-gray-900 font-medium">{income.received_from || "-"}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Receipt Mode</p>
              <p className="text-gray-900 font-medium">{income.receipt_mode || "-"}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Bank/Cash Account</p>
              <p className="text-gray-900 font-medium">{income.bank_cash_account || "-"}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Reference Number</p>
              <p className="text-gray-900 font-medium">{income.reference_number || "-"}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500 font-semibold uppercase">Invoice/Bill Number</p>
              <p className="text-gray-900 font-medium">{income.invoice_bill_number || "-"}</p>
            </div>
          </div>
        </div>

        {/* Attachments */}
        {(income.receipt_attachment_path ||
          income.proof_attachment_path ||
          income.invoice_attachment_path ||
          income.supporting_document_path) && (
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Attachments</h2>
            <div className="space-y-2">
              {renderAttachment(income.receipt_attachment_path, "Receipt")}
              {renderAttachment(income.proof_attachment_path, "Proof of Income")}
              {renderAttachment(income.invoice_attachment_path, "Invoice/Bill")}
              {renderAttachment(income.supporting_document_path, "Supporting Document")}
            </div>
          </div>
        )}

        {/* Description & Remarks */}
        {(income.description || income.remarks) && (
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Additional Information</h2>
            {income.description && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-gray-600 bg-gray-50 p-3 rounded">{income.description}</p>
              </div>
            )}
            {income.remarks && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Remarks</h3>
                <p className="text-gray-600 bg-gray-50 p-3 rounded">{income.remarks}</p>
              </div>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="border-t pt-6 text-xs text-gray-500">
          <p>Created: {dayjs(income.created_at).format("DD MMM YYYY HH:mm")}</p>
          <p>Last Updated: {dayjs(income.updated_at).format("DD MMM YYYY HH:mm")}</p>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-6">
        <Link
          href="/accounts-dashboard/other-income"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={18} />
          Back to Other Income
        </Link>
      </div>
    </div>
  );
}
