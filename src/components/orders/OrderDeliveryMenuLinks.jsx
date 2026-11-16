"use client";

import { canShowOrderDeliveryActions } from "@/lib/orderDeliveryEligibility";
import {
  countSavedDeliveryBatches,
  getRequiredDeliveryProofCount,
} from "@/lib/orderDeliverySlots";
import {
  orderHasDeliveryRecord,
} from "@/lib/orderDeliveryStatus";

/**
 * One delivery proof per dispatch wave (and per extra booking batch when applicable).
 */
export default function OrderDeliveryMenuLinks({
  order,
  userRole,
  DeliveryMenuItem,
}) {
  if (!canShowOrderDeliveryActions(order)) return null;

  const required = getRequiredDeliveryProofCount(order);
  const saved = countSavedDeliveryBatches(order);
  const hasRecord = orderHasDeliveryRecord(order);

  if (!hasRecord) {
    return (
      <DeliveryMenuItem order={order} userRole={userRole} variant="auto" />
    );
  }

  const items = [];

  for (let seq = 1; seq <= saved; seq += 1) {
    items.push(
      <DeliveryMenuItem
        key={`view-${seq}`}
        order={order}
        userRole={userRole}
        variant="view_batch"
        batchSequence={seq}
      />,
    );
  }

  if (saved < required) {
    items.push(
      <DeliveryMenuItem
        key={`update-${saved + 1}`}
        order={order}
        userRole={userRole}
        variant="update_batch"
        batchSequence={saved + 1}
      />,
    );
  }

  return <>{items}</>;
}