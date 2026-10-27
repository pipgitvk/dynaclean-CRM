"use client";

import { canShowOrderDeliveryActions } from "@/lib/orderDeliveryEligibility";
import {
  orderHasSecondDeliveryBatch,
  orderNeedsRemainDeliverySave,
} from "@/lib/orderDeliveryBatches";
import {
  isOrderFullyDelivered,
  orderHasDeliveryRecord,
} from "@/lib/orderDeliveryStatus";

/**
 * Partial / two-round delivery:
 * - 1st save → View Delivery + Update Delivery (Remain)
 * - 2nd save → View Delivery + View Delivery (Remain)
 * - Before any save → Update Delivery only
 */
export default function OrderDeliveryMenuLinks({
  order,
  userRole,
  DeliveryMenuItem,
}) {
  if (!canShowOrderDeliveryActions(order)) return null;

  const hasRecord = orderHasDeliveryRecord(order);
  const fully = isOrderFullyDelivered(order);
  const hasSecond = orderHasSecondDeliveryBatch(order);
  const needsRemainSave = orderNeedsRemainDeliverySave(order);

  if (hasRecord && fully && needsRemainSave) {
    return (
      <>
        <DeliveryMenuItem order={order} userRole={userRole} variant="view_first" />
        <DeliveryMenuItem
          order={order}
          userRole={userRole}
          variant="update_remain"
        />
      </>
    );
  }

  if (hasRecord && fully && hasSecond) {
    return (
      <>
        <DeliveryMenuItem order={order} userRole={userRole} variant="view_first" />
        <DeliveryMenuItem
          order={order}
          userRole={userRole}
          variant="view_remain"
        />
      </>
    );
  }

  if (hasRecord && !fully) {
    return (
      <>
        <DeliveryMenuItem order={order} userRole={userRole} variant="view_first" />
        <DeliveryMenuItem
          order={order}
          userRole={userRole}
          variant="update_remain"
        />
      </>
    );
  }

  if (hasRecord && fully) {
    return (
      <DeliveryMenuItem order={order} userRole={userRole} variant="view_first" />
    );
  }

  return (
    <DeliveryMenuItem order={order} userRole={userRole} variant="auto" />
  );
}
