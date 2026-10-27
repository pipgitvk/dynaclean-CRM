/**
 * Activate dispatch rows for the booking round, then load active rows for the form.
 * @param {string} orderId
 * @param {"first"|"remain"} round
 */
export async function loadDispatchFormRows(orderId, round = "first") {
  const activateUrl =
    round === "remain"
      ? "/api/dispatch/activate-remain"
      : "/api/dispatch/activate-first";

  const actRes = await fetch(activateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId }),
  });
  const actJson = await actRes.json().catch(() => ({}));
  if (!actRes.ok || !actJson.success) {
    throw new Error(
      actJson.error ||
        (round === "remain"
          ? "Dispatch (Remain) prepare failed"
          : "Dispatch prepare failed"),
    );
  }

  const res = await fetch(
    `/api/dispatch?order_id=${encodeURIComponent(orderId)}&scope=active`,
  );
  const json = await res.json();
  return json.success ? json.data || [] : [];
}
