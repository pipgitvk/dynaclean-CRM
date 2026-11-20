/** Invoice, order, and service IDs for upcoming installation rows. */
export default function UpcomingInstallationReferenceIds({
  record,
  className = "",
  serviceIdActions = null,
}) {
  const invoice = record?.invoice_number?.trim() || "—";
  const orderId = record?.order_id ?? "—";
  const serviceId = record?.service_id?.trim() || "—";

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
        <span>
          <span className="text-purple-600 font-bold">Ser:</span> {serviceId}
        </span>
      </div>
    </div>
  );
}
