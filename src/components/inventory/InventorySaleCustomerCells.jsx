import Link from "next/link";

function CellDash() {
  return <span className="text-gray-400">—</span>;
}

const linkClass =
  "text-blue-600 hover:text-blue-800 hover:underline font-medium";

function LabelValue({ label, children }) {
  return (
    <div className="flex flex-wrap gap-x-1.5">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="text-gray-900">{children}</span>
    </div>
  );
}

/** Single column: customer + client + company + order (Sale rows with order link only). */
export default function InventorySaleCustomerCells({ type, sale }) {
  if (type !== "Sale" || !sale) {
    return (
      <td className="p-3 text-gray-400 align-top">
        <CellDash />
      </td>
    );
  }

  const hasAny =
    sale.customer_id ||
    sale.client_name ||
    sale.company_name ||
    sale.order_id;

  if (!hasAny) {
    return (
      <td className="p-3 text-gray-400 align-top">
        <CellDash />
      </td>
    );
  }

  return (
    <td className="p-3 align-top min-w-[12rem]">
      <div className="space-y-0.5 text-xs leading-relaxed">
        <LabelValue label="Customer ID">
          {sale.customer_id && sale.customer_link ? (
            <Link href={sale.customer_link} className={linkClass}>
              {sale.customer_id}
            </Link>
          ) : sale.customer_id ? (
            sale.customer_id
          ) : (
            <CellDash />
          )}
        </LabelValue>
        <LabelValue label="Client">
          {sale.client_name || <CellDash />}
        </LabelValue>
        <LabelValue label="Company">
          {sale.company_name || <CellDash />}
        </LabelValue>
        <LabelValue label="Order ID">
          {sale.order_id && sale.order_link ? (
            <Link href={sale.order_link} className={linkClass}>
              {sale.order_id}
            </Link>
          ) : sale.order_id ? (
            sale.order_id
          ) : (
            <CellDash />
          )}
        </LabelValue>
      </div>
    </td>
  );
}
