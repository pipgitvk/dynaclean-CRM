const DELHIVERY_B2B_TRACK_BASE =
  "https://btob.api.delhivery.com/v2/track";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isDelhiveryRateLimitError(message, status) {
  if (status === 429) return true;
  const m = String(message || "").toLowerCase();
  return (
    m.includes("request limit") ||
    m.includes("rate limit") ||
    m.includes("try after") ||
    m.includes("too many request")
  );
}

/**
 * Call Delhivery B2B track API for one LR / waybill.
 * @returns {{ ok: boolean, data?: object, error?: string, status?: number }}
 */
export async function fetchDelhiveryB2bTrack(trackingId) {
  const id = String(trackingId ?? "").trim();
  if (!id) {
    return { ok: false, error: "trackingId is required" };
  }

  const url = `${DELHIVERY_B2B_TRACK_BASE}/${encodeURIComponent(id)}?mwbn=true`;
  const headers = { Accept: "application/json" };
  const token = process.env.DELHIVERY_B2B_API_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const upstream = await fetch(url, { headers, cache: "no-store" });
  const raw = await upstream.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (!upstream.ok) {
    const message =
      (data && (data.message || data.error || data.detail)) ||
      `Delhivery API error (${upstream.status})`;
    return { ok: false, error: message, status: upstream.status, data };
  }

  return { ok: true, data };
}

/** Retry when Delhivery returns rate-limit errors (waits 20s–120s between tries). */
export async function fetchDelhiveryB2bTrackWithRetry(
  trackingId,
  { maxAttempts = 5 } = {},
) {
  let last = { ok: false, error: "No attempt" };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await fetchDelhiveryB2bTrack(trackingId);
    if (last.ok) return last;
    const limited = isDelhiveryRateLimitError(last.error, last.status);
    if (!limited || attempt === maxAttempts) return last;
    await sleep(Math.min(120_000, 20_000 * attempt));
  }
  return last;
}

export function defaultDelhiveryTrackDelayMs() {
  const n = Number(process.env.DELHIVERY_TRACK_DELAY_MS);
  return Number.isFinite(n) && n >= 500 ? n : 2000;
}
