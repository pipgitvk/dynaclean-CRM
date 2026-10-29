/**
 * Resolve Delhivery B2B LR number for an order (tracking_id table + booking URLs).
 */

import {
  TRACKING_TYPE_DELIVERY,
  TRACKING_TYPE_RETURN,
} from "@/lib/orderTrackingIdPersist";
import { normalizeRoleKey, isSuperAdminRole } from "@/lib/roleKeyUtils";

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
 * @param {{ shipmentKind?: 'outbound' | 'return' }} [options]
 */
export async function fetchDelhiveryLrForOrder(
  conn,
  orderId,
  order = null,
  bookingBatches = [],
  options = {},
) {
  const shipmentKind = options.shipmentKind === "return" ? "return" : "outbound";
  const id = String(orderId ?? "").trim();
  if (!id) return null;

  if (shipmentKind === "return") {
    try {
      const [rows] = await conn.execute(
        `SELECT lr_number, booking_url
         FROM tracking_id
         WHERE order_id = ?
           AND type = ?
         ORDER BY id DESC
         LIMIT 1`,
        [id, TRACKING_TYPE_RETURN],
      );
      const row = rows?.[0];
      const fromLr = String(row?.lr_number ?? "").trim();
      if (fromLr) return fromLr;
      const fromRowUrl = parseDelhiveryLrFromUrl(row?.booking_url);
      if (fromRowUrl) return fromRowUrl;
    } catch {
      /* table may be missing */
    }

    const fromRef = String(order?.return_booking_ref ?? "").trim();
    if (fromRef) return fromRef;

    const fromReturnUrl = parseDelhiveryLrFromUrl(order?.return_booking_url);
    if (fromReturnUrl) return fromReturnUrl;

    return null;
  }

  try {
    const [rows] = await conn.execute(
      `SELECT lr_number, booking_url
       FROM tracking_id
       WHERE order_id = ?
         AND type = ?
       ORDER BY batch_sequence_no DESC, id DESC
       LIMIT 1`,
      [id, TRACKING_TYPE_DELIVERY],
    );
    const row = rows?.[0];
    const fromLr = String(row?.lr_number ?? "").trim();
    if (fromLr) return fromLr;
    const fromRowUrl = parseDelhiveryLrFromUrl(row?.booking_url);
    if (fromRowUrl) return fromRowUrl;
  } catch {
    /* table may be missing in some envs */
  }

  const fromOrderBooking = String(order?.booking_id ?? "").trim();
  if (fromOrderBooking) return fromOrderBooking;

  for (const url of collectBookingUrls(order, bookingBatches)) {
    const lr = parseDelhiveryLrFromUrl(url);
    if (lr) return lr;
  }

  return null;
}

const DELHIVERY_TRACKING_ROLES = new Set(["SUPERADMIN", "ADMIN"]);

/** Outbound Delhivery timeline — SUPERADMIN & ADMIN. */
export function canViewOrderDelhiveryTracking(...roles) {
  return roles.some((r) => {
    const k = normalizeRoleKey(r || "");
    if (isSuperAdminRole(r)) return true;
    return k === "ADMIN" || DELHIVERY_TRACKING_ROLES.has(k);
  });
}

/** Return shipment Delhivery timeline — SUPERADMIN & ADMIN only. */
export function canViewReturnShipmentTracking(...roles) {
  return roles.some((r) => {
    const k = normalizeRoleKey(r || "");
    if (isSuperAdminRole(r)) return true;
    return k === "ADMIN";
  });
}
