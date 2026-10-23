import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import getOrderData from "@/app/admin-dashboard/order/view/[order_id]/getOrderData";

const ALLOWED_ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "ACCOUNTANT",
  "HR HEAD",
  "SALES",
  "SALES CUM BACKOFFICE",
  "TEAM LEADER",
  "DIRECTOR",
  "GEM PORTAL",
  "GEM",
  "PRODUCTION ACCOUNTANT",
];

export async function GET(_request, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = payload.role;
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { order_id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    const data = await getOrderData(orderId, role);
    if (!data?.orderDetails) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET order view-data error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
