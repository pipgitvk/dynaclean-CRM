/**
 * Shipment tracking lines for order UI (Delivery / Porter / Wheelseye).
 * @typedef {{ provider: string, trackingNumber: string, trackingUrl: string }} OrderShipmentTrack
 */

function pickFirst(order, keys) {
  for (const key of keys) {
    const v = order?.[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function resolveTrackingUrl(provider, trackingNumber, explicitUrl) {
  const url = (explicitUrl || "").trim();
  if (isHttpUrl(url)) return url;
  const id = (trackingNumber || "").trim();
  if (!id) return "";
  if (isHttpUrl(id)) return id;

  const p = provider.toLowerCase();
  if (p === "porter") {
    return `https://porter.in/track/${encodeURIComponent(id)}`;
  }
  if (p === "wheelseye" || p === "wheels eye") {
    return `https://app.wheelseye.com/track/${encodeURIComponent(id)}`;
  }
  return "";
}

/**
 * @param {object} order neworder row
 * @param {Array<{ booking_id?: string, booking_url?: string, sequence_no?: number }>} [bookingBatches]
 * @returns {OrderShipmentTrack[]}
 */
export function collectOrderShipmentTracks(order, bookingBatches = []) {
  const tracks = [];
  const seen = new Set();

  const push = (provider, trackingNumber, trackingUrl) => {
    const num = (trackingNumber || "").trim();
    if (!num) return;
    const key = `${provider.toLowerCase()}::${num}`;
    if (seen.has(key)) return;
    seen.add(key);
    const url = resolveTrackingUrl(provider, num, trackingUrl);
    tracks.push({
      provider,
      trackingNumber: num,
      trackingUrl: url,
    });
  };

  const batches = Array.isArray(bookingBatches) ? bookingBatches : [];
  if (batches.length) {
    for (const batch of batches) {
      const label =
        batches.length > 1
          ? `Delivery (batch ${batch.sequence_no || "?"})`
          : "Delivery";
      push(label, batch.booking_id, batch.booking_url);
    }
  } else {
    push("Delivery", pickFirst(order, ["booking_id"]), pickFirst(order, ["booking_url"]));
  }

  push(
    "Porter",
    pickFirst(order, ["porter_delivery", "porter_tracking_id", "porter_tracking"]),
    pickFirst(order, ["porter_delivery_url", "porter_tracking_url"]),
  );

  push(
    "Wheelseye",
    pickFirst(order, ["wheelseye_delivery", "wheelseye_tracking"]),
    pickFirst(order, ["wheelseye_delivery_url", "wheelseye_tracking_url"]),
  );

  return tracks;
}
