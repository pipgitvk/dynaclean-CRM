"use client";

import Link from "next/link";
import { FileCheck } from "lucide-react";
import {
  canCreateAdditionalBooking,
  orderHasOpenDispatchBatch,
  orderHasPendingDispatchUnits,
} from "@/lib/orderDeliveryEligibility";

/** Two booking links when two batches exist (or partial flow still open). */
export function shouldShowSplitBookingViews(order) {
  const batches = order?.booking_batches || [];
  if (batches.length >= 2) return true;
  if (batches.length <= 1) return false;
  if (orderHasOpenDispatchBatch(order)) return false;
  return (
    canCreateAdditionalBooking(order) || orderHasPendingDispatchUnits(order)
  );
}

export default function OrderBookingViewMenuLinks({
  order,
  basePath,
  canSee = true,
  linkClassName = "flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700",
  onClick,
}) {
  if (!canSee) return null;

  const batches = order?.booking_batches || [];
  const hasBooking =
    batches.length > 0 ||
    (order?.booking_id &&
      String(order.booking_id).trim() !== "" &&
      String(order.booking_id) !== "0");

  if (!hasBooking) return null;

  const split = shouldShowSplitBookingViews(order);
  const latest =
    batches.length > 0 ? batches[batches.length - 1] : null;
  if (!split) {
    return (
      <Link
        href={`${basePath}/view-booking/${order.order_id}`}
        className={linkClassName}
        title="View Booking"
        onClick={onClick}
      >
        <FileCheck size={16} />
        <span>View Booking</span>
      </Link>
    );
  }

  return (
    <>
      <Link
        href={`${basePath}/view-booking/${order.order_id}?seq=1`}
        className={linkClassName}
        title="View first booking"
        onClick={onClick}
      >
        <FileCheck size={16} />
        <span>View Booking</span>
      </Link>
      <Link
        href={`${basePath}/view-booking/${order.order_id}?seq=remain`}
        className={linkClassName}
        title={
          latest?.booking_id
            ? `Remaining booking: ${latest.booking_id}`
            : "View remaining booking"
        }
        onClick={onClick}
      >
        <FileCheck size={16} />
        <span>View Booking (Remain)</span>
      </Link>
    </>
  );
}
