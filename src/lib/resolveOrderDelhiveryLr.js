/**
 * Resolve Delhivery B2B LR number for an order (tracking_id table + booking URLs).
 */

const LR_URL_RE = /\/lr\/(\d+)/i;

export function parseDelhiveryLrFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw || !/delhivery\.com/i.test(raw)) return null;
  const m = raw.match(LR_URL_RE);
  if (m?.[1] && /^\d+$/.test(m[1])) return m[1];
  const last = raw.replace(/\/+$/, "").split("/").pop();
  if (last && /^\d+$/.test(last)) return last;
  return null;
}

function collectBookingUrls(order, bookingBatches = []) {
  const urls = [];
  const batches = Array.isArray(bookingBatches) ? bookingBatches : [];
  for (const b of batches) {
    if (b?.booking_url) urls.push(String(b.booking_url).trim());
  }
  if (order?.booking_url) urls.push(String(order.booking_url).trim());
  return urls.filter(Boolean);
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string|number} orderId
 * @param {object} [order] neworder row
 * @param {Array} [bookingBatches]
 */
export async function fetchDelhiveryLrForOrder(
  conn,
  orderId,
  order = null,
  bookingBatches = [],
) {
  const id = String(orderId ?? "").trim();
  if (!id) return null;

  try {
    const [rows] = await conn.execute(
      `SELECT lr_number, booking_url
       FROM tracking_id
       WHERE order_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [id],
    );
    const row = rows?.[0];
    if (row?.lr_number && /^\d+$/.test(String(row.lr_number).trim())) {
      return String(row.lr_number).trim();
    }
    const fromRowUrl = parseDelhiveryLrFromUrl(row?.booking_url);
    if (fromRowUrl) return fromRowUrl;
  } catch {
    /* table may be missing in some envs */
  }

  for (const url of collectBookingUrls(order, bookingBatches)) {
    const lr = parseDelhiveryLrFromUrl(url);
    if (lr) return lr;
  }

  return null;
}
