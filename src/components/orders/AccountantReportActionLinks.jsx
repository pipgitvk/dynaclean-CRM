import Link from "next/link";
import { ClipboardList, FileText, UploadCloud } from "lucide-react";
import { hasOrderInvoiceReport } from "@/lib/orderDocumentEditRules";

/**
 * Accountant order menu: View Sales + Upload Report, or View Sales + View Report.
 */
export default function AccountantReportActionLinks({
  order,
  uploadHref,
  viewHref,
  viewSalesHref,
  onClick,
}) {
  const hasReport = hasOrderInvoiceReport(order);

  const viewSalesLink =
    viewSalesHref ? (
      <Link
        href={viewSalesHref}
        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 w-full"
        title="View Sales"
        onClick={onClick}
      >
        <ClipboardList size={16} />
        <span>View Sales</span>
      </Link>
    ) : null;

  if (hasReport) {
    return (
      <>
        {viewSalesLink}
        <Link
          href={viewHref}
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 w-full"
          title="View Report"
          onClick={onClick}
        >
          <FileText size={16} />
          <span>View Report</span>
        </Link>
      </>
    );
  }

  return (
    <>
      {viewSalesLink}
      <Link
        href={uploadHref}
        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-yellow-700 w-full"
        title="Upload Report"
        onClick={onClick}
      >
        <UploadCloud size={16} />
        <span>Upload Report</span>
      </Link>
    </>
  );
}
