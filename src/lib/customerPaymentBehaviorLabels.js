/** Display labels for customer payment behavior report (API keys unchanged). */

export const PAYMENT_BEHAVIOR_BADGES = {
  late_payment: {
    text: "Overdue Cleared",
    color: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  },
  missing_payment: {
    text: "Overdue",
    color: "bg-red-100 text-red-800 border border-red-300",
  },
  partial_overdue: {
    text: "Overdue",
    color: "bg-red-100 text-red-800 border border-red-300",
  },
  on_time: {
    text: "On Time Paid",
    color: "bg-green-100 text-green-800 border border-green-300",
  },
  partial_payment: {
    text: "Partial Payment",
    color: "bg-blue-100 text-blue-800 border border-blue-300",
  },
  pending: {
    text: "Payment Awaited",
    color: "bg-gray-100 text-gray-800 border border-gray-300",
  },
  paid_no_date: {
    text: "Paid (No Date)",
    color: "bg-gray-100 text-gray-600 border border-gray-300",
  },
  no_due_date: {
    text: "No Due Date",
    color: "bg-gray-100 text-gray-600 border border-gray-300",
  },
  paid_no_due_date: {
    text: "Paid (No Due Date)",
    color: "bg-gray-100 text-gray-600 border border-gray-300",
  },
};

export function getPaymentBehaviorLabel(behavior) {
  return PAYMENT_BEHAVIOR_BADGES[behavior]?.text || behavior || "";
}

export function getPaymentBehaviorBadgeConfig(behavior) {
  return (
    PAYMENT_BEHAVIOR_BADGES[behavior] || {
      text: behavior || "Unknown",
      color: "bg-gray-100 text-gray-800",
    }
  );
}
