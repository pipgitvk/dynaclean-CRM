import Link from "next/link";
import { listUpcomingInstallationServiceIds } from "@/components/installation/UpcomingInstallationServiceStatusColumn";

function listSerialNumbers(record) {
  const raw = String(record?.serial_number || "").trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,|;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Invoice, order, service IDs, and serial numbers for upcoming installation rows. */
export default function UpcomingInstallationReferenceIds({
  record,
  className = "",
  serviceIdActions = null,
  dashboardBase = "",
}) {
  const invoice = record?.invoice_number?.trim() || "—";
  const orderId = record?.order_id ?? "—";
  const serviceIds = listUpcomingInstallationServiceIds(record);
  const serials = listSerialNumbers(record);

  return (
    <div className={`space-y-1 text-xs ${className}`}>
      <div>
        <span className="text-blue-600 font-bold">Inv:</span> {invoice}
      </div>
      <div>
        <span className="text-green-600 font-bold">Ord:</span> {orderId}
      </div>
      <div className="flex flex-wrap items-start gap-1.5">
        {serviceIdActions ? (
          <span className="shrink-0">{serviceIdActions}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <span className="text-purple-600 font-bold">Ser:</span>
          {serviceIds.length === 0 ? (
            <span className="ml-1">—</span>
          ) : (
            <div className="mt-0.5 space-y-0.5">
              {serviceIds.map((id) =>
                dashboardBase ? (
                  <div key={id}>
                    <Link
                      href={`/${dashboardBase}/complete-service/${encodeURIComponent(id)}`}
                      className="font-semibold text-violet-700 hover:underline"
                    >
                      {id}
                    </Link>
                  </div>
                ) : (
                  <div key={id} className="font-semibold text-slate-800">
                    {id}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
      <div>
        <span className="text-amber-700 font-bold">S/N:</span>
        {serials.length === 0 ? (
          <span className="ml-1">—</span>
        ) : (
          <div className="mt-0.5 space-y-0.5 font-mono text-slate-800">
            {serials.map((sn) => (
              <div key={sn}>{sn}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}