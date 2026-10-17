import Link from "next/link";
import { FileText, FilePlus } from "lucide-react";

/** Add Invoice / View Invoice — one active tax invoice per order. */
export default function OrderInvoiceMenuLinks({
  order,
  invoicesBasePath,
  onClick,
}) {
  const orderId = String(order?.order_id || "");
  const quote = String(order?.quote_number || "");
  const active = String(order?.active_invoice_number || "").trim();

  if (active) {
    return (
      <Link
        href={`${invoicesBasePath}/${encodeURIComponent(active)}`}
        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
        title="View Invoice"
        onClick={onClick}
      >
        <FileText size={16} />
        <span>View Invoice</span>
      </Link>
    );
  }

  const params = new URLSearchParams();
  if (quote) params.set("quotation_number", quote);
  if (orderId) {
    params.set("order_id", orderId);
    const orderListPath = invoicesBasePath.replace(/\/invoices\/?$/, "/order");
    params.set("return_to", orderListPath);
  }

  return (
    <Link
      href={`${invoicesBasePath}/new?${params.toString()}`}
      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
      title="Add Invoice"
      onClick={onClick}
    >
      <FilePlus size={16} />
      <span>Add Invoice</span>
    </Link>
  );
}
