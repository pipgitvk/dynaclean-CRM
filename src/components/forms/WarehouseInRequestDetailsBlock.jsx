import { formatCrmDateOnly } from "@/lib/crmDateFormat";
import { CategoryBadge } from "@/components/forms/warehouseInUi";
import { warehouseInQtyFields } from "@/lib/warehouseInQuantities";

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        value={value ?? ""}
        disabled
        readOnly
        className="w-full border p-2 rounded bg-white text-gray-900"
      />
    </div>
  );
}

export default function WarehouseInRequestDetailsBlock({
  item,
  lineQty,
  onLineQtyChange,
  showReceivedQuantity = true,
  hideLineItemFields = false,
}) {
  const isSpare = item.__source === "spare" || item.category === "Spare";
  const transport = item.mode_of_transport || "N/A";
  const { requested, received, remaining } = warehouseInQtyFields(item);

  return (
    <div className="bg-gray-50 p-4 rounded border">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h4 className="font-semibold">Request Details</h4>
        <CategoryBadge category={item.category} />
        {item.id ? (
          <span className="text-xs text-gray-500">Request #{item.id}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isSpare ? (
          <ReadOnlyField
            label="Spare ID"
            value={item.spare_id ?? item.product_code}
          />
        ) : (
          <ReadOnlyField label="Product Code" value={item.product_code} />
        )}
        {!hideLineItemFields ? (
          <>
            {isSpare ? (
              <ReadOnlyField
                label="Spare Name"
                value={item.spare_name ?? item.product_name}
              />
            ) : (
              <ReadOnlyField label="Product Name" value={item.product_name} />
            )}
            <ReadOnlyField label="Requested Quantity" value={requested} />
            <ReadOnlyField label="Received Quantity" value={received} />
            <ReadOnlyField label="Remaining Quantity" value={remaining} />
          </>
        ) : null}
        <ReadOnlyField label="From Company" value={item.from_company || "N/A"} />
        <ReadOnlyField label="Contact" value={item.contact || "N/A"} />
        <ReadOnlyField label="Mode of Transport" value={transport} />
        {transport === "Porter" ? (
          <ReadOnlyField
            label="Porter Contact"
            value={item.porter_contact || "N/A"}
          />
        ) : null}
        <ReadOnlyField label="Created By" value={item.created_by || ""} />
        <ReadOnlyField
          label="Request Date"
          value={
            item.created_at ? formatCrmDateOnly(item.created_at) : ""
          }
        />
        {!isSpare && item.invoice_number ? (
          <ReadOnlyField label="Invoice Number" value={item.invoice_number} />
        ) : null}
        {!isSpare && item.invoice_date ? (
          <ReadOnlyField
            label="Invoice Date"
            value={formatCrmDateOnly(item.invoice_date)}
          />
        ) : null}
      </div>

      {showReceivedQuantity && onLineQtyChange ? (
        <div className="mt-4 max-w-xs">
          <label className="block mb-1 font-medium">Received Quantity *</label>
          <input
            type="number"
            min={1}
            className="w-full border p-2 rounded"
            value={lineQty ?? ""}
            onChange={(e) => onLineQtyChange(e.target.value)}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Remaining: {remaining} · Requested: {requested}
          </p>
        </div>
      ) : null}
    </div>
  );
}
