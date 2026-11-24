"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye } from "lucide-react";
import { listUpcomingInstallationServiceIds } from "@/components/installation/UpcomingInstallationServiceStatusColumn";
import { listOpenInstallationSerialNumbers } from "@/lib/openInstallationServiceLineItems";
import OpenInstallationServicesModal from "@/components/installation/OpenInstallationServicesModal";
import { openInstallationViewMoreBtnClassCompact } from "@/components/installation/openInstallationViewMoreBtnClass";

const LIST_PREVIEW_COUNT = 3;

/** Invoice, order, service IDs, and serial numbers for upcoming installation rows. */
export default function UpcomingInstallationReferenceIds({
  record,
  className = "",
  serviceIdActions = null,
  dashboardBase = "",
  /** When true, only invoice + order — no service ID / serial lists in the table. */
  hideServiceAndSerialLists = false,
}) {
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [serialModalOpen, setSerialModalOpen] = useState(false);

  const invoice = record?.invoice_number?.trim() || "—";
  const orderId = record?.order_id ?? "—";
  const quoteNumber = String(record?.quote_number || "").trim() || "—";
  const serviceIds = listUpcomingInstallationServiceIds(record);
  const serials = listOpenInstallationSerialNumbers(record);

  const renderServiceIdRow = (id, idx) =>
    dashboardBase ? (
      <div key={`${id}-${idx}`}>
        <Link
          href={`/${dashboardBase}/complete-service/${encodeURIComponent(id)}`}
          className="font-semibold text-violet-700 hover:underline"
        >
          {id}
        </Link>
      </div>
    ) : (
      <div key={`${id}-${idx}`} className="font-semibold text-slate-800">
        {id}
      </div>
    );

  const visibleServiceIds =
    serviceIds.length > LIST_PREVIEW_COUNT
      ? serviceIds.slice(0, LIST_PREVIEW_COUNT)
      : serviceIds;
  const serviceHidden =
    serviceIds.length > LIST_PREVIEW_COUNT
      ? serviceIds.length - LIST_PREVIEW_COUNT
      : 0;

  const visibleSerials =
    serials.length > LIST_PREVIEW_COUNT ? serials.slice(0, LIST_PREVIEW_COUNT) : serials;
  const serialHidden =
    serials.length > LIST_PREVIEW_COUNT ? serials.length - LIST_PREVIEW_COUNT : 0;

  return (
    <div className={`space-y-1 text-xs ${className}`}>
      <div>
        <span className="text-blue-600 font-bold">Inv:</span> {invoice}
      </div>
      <div>
        <span className="text-green-600 font-bold">Ord:</span> {orderId}
      </div>
      <div>
        <span className="text-cyan-700 font-bold">Quote:</span> {quoteNumber}
      </div>
      {hideServiceAndSerialLists ? null : (
        <>
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
                  {visibleServiceIds.map((id, idx) => renderServiceIdRow(id, idx))}
                  {serviceHidden > 0 ? (
                    <button
                      type="button"
                      onClick={() => setServicesModalOpen(true)}
                      className={openInstallationViewMoreBtnClassCompact}
                      title={`View all ${serviceIds.length} services`}
                    >
                      <Eye className="h-3 w-3" aria-hidden />
                      <span>+{serviceHidden} more</span>
                    </button>
                  ) : null}
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
                {visibleSerials.map((sn, idx) => (
                  <div key={`${sn}-${idx}`}>{sn}</div>
                ))}
                {serialHidden > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSerialModalOpen(true)}
                    className={`${openInstallationViewMoreBtnClassCompact} font-sans`}
                    title={`View all ${serials.length} serial numbers`}
                  >
                    <Eye className="h-3 w-3" aria-hidden />
                    <span>+{serialHidden} more</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <OpenInstallationServicesModal
            isOpen={servicesModalOpen}
            onClose={() => setServicesModalOpen(false)}
            title={`Services (${serviceIds.length})`}
            row={record}
            dashboardBase={dashboardBase}
            showStatusEditor={false}
          />
          <OpenInstallationServicesModal
            isOpen={serialModalOpen}
            onClose={() => setSerialModalOpen(false)}
            title={`Serial numbers & services (${serials.length})`}
            row={record}
            dashboardBase={dashboardBase}
            showStatusEditor={false}
            showSerial
          />
        </>
      )}
    </div>
  );
}