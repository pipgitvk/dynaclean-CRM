"use client";

import OrderDelhiveryTrackingPanel from "@/components/orders/OrderDelhiveryTrackingPanel";

/** Outbound + return Delhivery timelines for any order the user can open. */
export default function OrderDelhiveryTrackingSection({
  orderId,
  delhiveryLr = null,
  returnDelhiveryLr = null,
}) {
  return (
    <>
      {delhiveryLr ? (
        <OrderDelhiveryTrackingPanel
          lrNumber={delhiveryLr}
          orderId={orderId}
          shipmentLabel="Outbound shipment"
        />
      ) : null}
      {returnDelhiveryLr ? (
        <OrderDelhiveryTrackingPanel
          lrNumber={returnDelhiveryLr}
          orderId={orderId}
          shipmentLabel="Return shipment"
          variant="return"
        />
      ) : null}
    </>
  );
}
