import { hasOrderInvoiceReport } from "@/lib/orderDocumentEditRules";

export const ORDER_PIPELINE_STAGES = [
  "Sales",
  "Account",
  "Admin",
  "Dispatch",
  "Delivered",
  "Installation Report",
  "Complete",
];

const OPERATIONAL_STEP_COUNT = 6;

function hasOrderBooking(order) {
  const raw = order?.booking_id;
  if (raw == null) return false;
  const s = String(raw).trim();
  return s !== "" && s !== "0";
}

function isStatusOne(value) {
  return Number(value) === 1;
}

/** Per-step completion for stepper dots (Account = invoice report only). */
function isPipelineStepComplete(stepIndex, order, statuses) {
  const o = order || {};
  const s = statuses || {};

  switch (stepIndex) {
    case 0:
      return (
        isStatusOne(s.sales_status) ||
        String(o.approval_status || "").toLowerCase() === "approved" ||
        hasOrderInvoiceReport(o) ||
        hasOrderBooking(o) ||
        isStatusOne(s.admin_status) ||
        isStatusOne(s.dispatch_status) ||
        isStatusOne(s.delivery_status)
      );
    case 1:
      return hasOrderInvoiceReport(o);
    case 2:
      return isStatusOne(s.admin_status) || hasOrderBooking(o);
    case 3:
      return isStatusOne(s.dispatch_status);
    case 4:
      return isStatusOne(s.delivery_status);
    case 5:
      return isStatusOne(s.installation_status);
    default:
      return false;
  }
}

export function getOrderPipelineStepCompletions(order, statuses) {
  const operational = Array.from({ length: OPERATIONAL_STEP_COUNT }, (_, i) =>
    isPipelineStepComplete(i, order, statuses),
  );
  const allOperationalDone = operational.every(Boolean);
  return [...operational, allOperationalDone];
}

function furthestCompletedStepIndex(operationalCompletions) {
  for (let i = operationalCompletions.length - 1; i >= 0; i--) {
    if (operationalCompletions[i]) return i;
  }
  return 0;
}

export function deriveOrderPipelineProgress(order, statuses) {
  const stepCompleted = getOrderPipelineStepCompletions(order, statuses);
  const operational = stepCompleted.slice(0, OPERATIONAL_STEP_COUNT);
  const allDone = stepCompleted[OPERATIONAL_STEP_COUNT];

  if (allDone) {
    return {
      stages: ORDER_PIPELINE_STAGES,
      currentStage: "Complete",
      currentIndex: ORDER_PIPELINE_STAGES.length - 1,
      progressPercent: 100,
      stepCompleted,
    };
  }

  const furthest = furthestCompletedStepIndex(operational);
  const currentStage = ORDER_PIPELINE_STAGES[furthest];
  const progressPercent =
    (furthest / (ORDER_PIPELINE_STAGES.length - 1)) * 100;

  return {
    stages: ORDER_PIPELINE_STAGES,
    currentStage,
    currentIndex: furthest,
    progressPercent,
    stepCompleted,
  };
}
