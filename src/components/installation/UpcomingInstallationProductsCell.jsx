"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { parseOpenInstallationDispatchItems } from "@/lib/openInstallationDispatchItems";
import { openInstallationModelPillClass } from "@/lib/openInstallationModelPill";
import OpenInstallationServicesModal from "@/components/installation/OpenInstallationServicesModal";
import { openInstallationViewMoreBtnClass } from "@/components/installation/openInstallationViewMoreBtnClass";

const PRODUCT_PREVIEW_COUNT = 3;

function ProductLine({ code, name }) {
  return (
    <li className="space-y-0.5">
      {code ? (
        <span
          className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-bold leading-tight ${openInstallationModelPillClass(code)}`}
        >
          {code}
        </span>
      ) : null}
      {name ? <p className="text-xs leading-snug text-slate-700">{name}</p> : null}
    </li>
  );
}

/** Model + name dispatch lines with 3-item preview and full services table modal. */
export default function UpcomingInstallationProductsCell({
  record,
  dashboardBase = "",
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const items = parseOpenInstallationDispatchItems(record?.model, record?.name);

  if (!items.length) {
    const model = String(record?.model || "").trim();
    const name = String(record?.name || "").trim();
    if (!model && !name) return <span className="text-slate-400">—</span>;
    return (
      <div className="text-xs text-slate-700">
        {model ? <span className="font-semibold">{model}</span> : null}
        {name ? <p>{name}</p> : null}
      </div>
    );
  }

  const hasMore = items.length > PRODUCT_PREVIEW_COUNT;
  const visible = hasMore ? items.slice(0, PRODUCT_PREVIEW_COUNT) : items;
  const hiddenCount = items.length - PRODUCT_PREVIEW_COUNT;

  return (
    <>
      <ul className="min-w-[9rem] max-w-[14rem] list-none space-y-2">
        {visible.map((it, idx) => (
          <ProductLine key={`${it.code}-${idx}`} code={it.code} name={it.name} />
        ))}
        {hasMore ? (
          <li>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className={openInstallationViewMoreBtnClass}
              title={`View all ${items.length} products`}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
              <span>+{hiddenCount} more</span>
            </button>
          </li>
        ) : null}
      </ul>

      <OpenInstallationServicesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Products & services (${items.length})`}
        row={record}
        dashboardBase={dashboardBase}
        showStatusEditor={false}
      />
    </>
  );
}