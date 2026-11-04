import {
  getPaymentBehaviorBadgeConfig,
} from "@/lib/customerPaymentBehaviorLabels";

export default function PaymentBehaviorBadge({ behavior }) {
  const badge = getPaymentBehaviorBadgeConfig(behavior);
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}
    >
      {badge.text}
    </span>
  );
}
