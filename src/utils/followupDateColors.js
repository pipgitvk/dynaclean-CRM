import dayjs from "dayjs";

/** Solid card backgrounds (TaskCard-style) */
export const FOLLOWUP_CARD_RGB = {
  overdue: "rgb(220, 53, 69)",
  due_soon: "rgb(255, 153, 51)",
  upcoming: "rgb(60, 179, 113)",
  far: "rgb(100, 181, 246)",
  none: "rgb(255, 180, 100)",
};

export function getFollowupCardBackgroundFromHours(hours) {
  if (hours === null || hours === undefined) return FOLLOWUP_CARD_RGB.none;
  if (hours < 0) return FOLLOWUP_CARD_RGB.overdue;
  if (hours <= 2) return FOLLOWUP_CARD_RGB.due_soon;
  if (hours <= 12) return FOLLOWUP_CARD_RGB.upcoming;
  return FOLLOWUP_CARD_RGB.far;
}

export function getFollowupCardBackgroundColor(nextFollowupDate) {
  if (!nextFollowupDate) return FOLLOWUP_CARD_RGB.none;
  const hours = dayjs(nextFollowupDate).diff(dayjs(), "hour", true);
  return getFollowupCardBackgroundFromHours(hours);
}

/**
 * Follow-up urgency styles for dashboard badges/cards.
 *
 * 🔴 Red           — overdue (date/time passed)
 * 🟠 Light Orange  — due within next 2 hours
 * 🟢 Light Green   — more than 2 hours, within 12 hours
 * 🔵 Light Sky Blue — more than 12 hours away
 */
export function getFollowupDateUrgency(nextFollowupDate) {
  if (!nextFollowupDate) {
    return {
      key: "none",
      label: "No Date",
      hours: null,
      bg: "bg-gray-50",
      border: "border-gray-200",
      badge: "bg-gray-400",
      text: "text-gray-600",
      dot: "bg-gray-400",
    };
  }

  const hours = dayjs(nextFollowupDate).diff(dayjs(), "hour", true);

  if (hours < 0) {
    return {
      key: "overdue",
      label: "Overdue",
      hours,
      bg: "bg-red-50",
      border: "border-red-300",
      badge: "bg-red-500",
      text: "text-red-700",
      dot: "bg-red-500",
    };
  }

  if (hours <= 2) {
    return {
      key: "due_soon",
      label: "Due Soon",
      hours,
      bg: "bg-orange-50",
      border: "border-orange-200",
      badge: "bg-orange-400",
      text: "text-orange-800",
      dot: "bg-orange-400",
    };
  }

  if (hours <= 12) {
    return {
      key: "upcoming",
      label: "Upcoming",
      hours,
      bg: "bg-green-50",
      border: "border-green-200",
      badge: "bg-green-500",
      text: "text-green-800",
      dot: "bg-green-500",
    };
  }

  return {
    key: "far",
    label: "Far Upcoming",
    hours,
    bg: "bg-sky-50",
    border: "border-sky-200",
    badge: "bg-sky-400",
    text: "text-sky-800",
    dot: "bg-sky-400",
  };
}
