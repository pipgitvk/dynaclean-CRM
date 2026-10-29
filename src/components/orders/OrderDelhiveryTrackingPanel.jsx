"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import DelhiveryTrackingTimeline, {
  delhiveryTimelineFromTrackPayload,
} from "@/components/orders/DelhiveryTrackingTimeline";
import DelhiveryShipmentDetailsHover from "@/components/orders/DelhiveryShipmentDetailsHover";
import { orderStatusHeadline } from "@/lib/delhiveryB2bTrackingUi";

export default function OrderDelhiveryTrackingPanel({
  lrNumber,
  orderId,
  shipmentLabel = "Delhivery shipment",
}) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(lrNumber));

  useEffect(() => {
    const lr = String(lrNumber || "").trim();
    if (!lr) {
      setResult(null);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setResult(null);

    (async () => {
      try {
        const params = new URLSearchParams({ trackingId: lr });
        const res = await fetch(`/api/delhivery/b2b-track?${params}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Could not load Delhivery tracking");
        }
        setResult(json.data);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Tracking unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lrNumber]);

  const timeline = useMemo(
    () => (result ? delhiveryTimelineFromTrackPayload(result) : []),
    [result],
  );

  const lr = String(lrNumber || "").trim();
  if (!lr) return null;

  const headline = result
    ? orderStatusHeadline(result.status)
    : shipmentLabel;
  const delivered = String(result?.status || "")
    .toUpperCase()
    .includes("DELIVER");
  const awb = result?.mwbn || "";

  return (
    <div className="min-w-0 overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-visible rounded-t-xl bg-[#3B966F] px-3 py-3 text-white sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <h2 className="text-sm font-bold leading-snug sm:text-lg">{headline}</h2>
            {delivered ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" strokeWidth={2.5} />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm">
            <span className="break-all">
              LR <span className="font-semibold">#{lr}</span>
            </span>
            <DelhiveryShipmentDetailsHover
              result={result}
              lr={lr}
              awb={awb}
              disabled={loading || !result}
              label="More details"
            />
          </div>
        </div>
        {orderId ? (
          <p className="mt-1.5 text-[11px] text-white/80 sm:text-xs">
            Order {orderId}
            {shipmentLabel ? ` · ${shipmentLabel}` : ""}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 px-2 py-3 sm:px-5 sm:py-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#3B966F]" />
            Loading live tracking…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <DelhiveryTrackingTimeline steps={timeline} layout="vertical" />
            </div>
            <div className="hidden md:block">
              <DelhiveryTrackingTimeline steps={timeline} layout="horizontal" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
