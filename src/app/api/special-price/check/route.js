import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  getApprovedSpecialPrice,
  getQuotationItemBasePricing,
  resolveQuotationItemByCode,
} from "@/lib/getApprovedSpecialPrice";

function normCode(value) {
  return String(value ?? "").trim();
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const customerId = String(body.customer_id ?? "").trim();
    const productCodeInput = normCode(body.product_code || body.item_code);
    const itemTypeInput = normCode(body.item_type).toLowerCase() || null;

    if (!customerId || !productCodeInput) {
      return NextResponse.json(
        { error: "customer_id and product_code are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const item = await resolveQuotationItemByCode(conn, productCodeInput);

    const { originalPrice, gstRate } = await getQuotationItemBasePricing(
      conn,
      item
    );

    const resolvedCode = item?.itemCode ?? productCodeInput;
    const resolvedType = item?.itemType ?? itemTypeInput;

    const specialPrice = await getApprovedSpecialPrice(
      conn,
      customerId,
      item?.itemId ?? null,
      resolvedCode,
      resolvedType
    );

    if (item == null && specialPrice == null) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const finalPrice =
      specialPrice != null && Number.isFinite(specialPrice)
        ? specialPrice
        : originalPrice;

    return NextResponse.json({
      success: true,
      item_type: resolvedType,
      product_id: item?.itemId ?? null,
      product_code: resolvedCode,
      original_price: originalPrice,
      special_price: specialPrice,
      final_price: finalPrice,
      gst_rate: gstRate,
      has_special_price: specialPrice != null && Number.isFinite(specialPrice),
    });
  } catch (err) {
    console.error("❌ Special price check failed:", err);

    return NextResponse.json(
      { error: "Special price check failed" },
      { status: 500 }
    );
  }
}
