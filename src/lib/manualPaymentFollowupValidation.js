import dayjs from "dayjs";

export function getNextFollowupDateBounds(reference = dayjs()) {
  const now = dayjs(reference);
  return {
    min: now.format("YYYY-MM-DDTHH:mm"),
    max: now.add(1, "month").format("YYYY-MM-DDTHH:mm"),
  };
}

export function validateNextFollowupDate(value, reference = dayjs()) {
  if (!value || !String(value).trim()) {
    return { ok: false, error: "Next follow-up date is required" };
  }

  const parsed = dayjs(String(value).trim().replace(" ", "T"));
  if (!parsed.isValid()) {
    return { ok: false, error: "Invalid next follow-up date" };
  }

  const now = dayjs(reference);
  const max = now.add(1, "month");

  if (parsed.isBefore(now, "minute")) {
    return {
      ok: false,
      error: "Next follow-up cannot be before the current date and time",
    };
  }

  if (parsed.isAfter(max, "minute")) {
    return {
      ok: false,
      error: "Next follow-up can only be scheduled up to 1 month from today",
    };
  }

  return { ok: true };
}
