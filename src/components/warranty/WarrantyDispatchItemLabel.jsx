import { openInstallationModelPillClass } from "@/lib/openInstallationModelPill";

export default function WarrantyDispatchItemLabel({
  productName,
  model,
  serialNumber,
  customerName,
  itemKind = "product",
  compact = false,
}) {
  const name = String(productName || "Item").trim();
  const code = String(model || "").trim();
  const serial = String(serialNumber || "").trim();
  const customer = String(customerName || "").trim();
  const isSpare = itemKind !== "product";

  return (
    <div className={`min-w-0 ${compact ? "space-y-1" : "space-y-2"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            isSpare
              ? "border-purple-200 bg-purple-50 text-purple-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          {isSpare ? "Spare" : "Product"}
        </span>
        {code ? (
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold ${openInstallationModelPillClass(code)}`}
          >
            {code}
          </span>
        ) : null}
      </div>
      <p
        className={`font-semibold leading-snug text-slate-900 ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {name}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        {serial ? (
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-amber-800">S/N</span>
            <span className="rounded border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-amber-950">
              {serial}
            </span>
          </span>
        ) : (
          <span className="text-slate-400">No serial</span>
        )}
        {customer ? (
          <>
            <span className="text-slate-300">·</span>
            <span>
              <span className="font-medium text-slate-500">Customer</span>{" "}
              <span className="font-medium text-slate-800">{customer}</span>
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}