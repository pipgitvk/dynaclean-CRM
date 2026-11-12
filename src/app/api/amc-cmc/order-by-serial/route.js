import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  sqlTrimUtf8Eq,
  sqlTrimUtf8EqColumns,
} from "@/lib/sqlUtf8Compare";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serial = String(
      new URL(request.url).searchParams.get("serial") || "",
    ).trim();
    if (!serial) {
      return NextResponse.json(
        { error: "serial is required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();
    const serialOnDispatch = sqlTrimUtf8Eq("d.serial_no", "?");
    const quoteJoin = sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number");
    const quoteOnQr = sqlTrimUtf8EqColumns("qr.quote_number", "no.quote_number");
    const serialOnWp = sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no");

    const [rows] = await conn.execute(
      `SELECT
          no.order_id,
          no.quote_number,
          no.invoice_number AS order_invoice_number,
          no.invoice_date AS order_invoice_date,
          no.company_name AS order_company_name,
          no.client_name AS order_client_name,
          no.contact AS order_contact,
          no.email AS order_email,
          no.company_address AS order_company_address,
          no.delivery_location,
          no.created_at AS order_created_at,
          qr.quote_date,
          qr.grand_total,
          qr.company_name AS quotation_company_name,
          d.id AS dispatch_id,
          d.item_code AS dispatch_item_code,
          qi.item_name AS product_name,
          qi.item_code AS model,
          wp.invoice_number AS warranty_invoice_number,
          wp.invoice_date AS warranty_invoice_date,
          wp.customer_name,
          wp.product_name AS warranty_product_name,
          wp.model AS warranty_model
       FROM dispatch d
       INNER JOIN neworder no ON ${quoteJoin}
       LEFT JOIN quotations_records qr ON ${quoteOnQr}
       LEFT JOIN quotation_items qi
         ON ${sqlTrimUtf8EqColumns("qi.quote_number", "no.quote_number")}
        AND ${sqlTrimUtf8EqColumns("qi.item_code", "d.item_code")}
       LEFT JOIN warranty_products wp ON ${serialOnWp}
       WHERE d.serial_no IS NOT NULL
         AND TRIM(d.serial_no) <> ''
         AND ${serialOnDispatch}
       ORDER BY no.created_at DESC, d.id DESC
       LIMIT 1`,
      [serial],
    );

    if (!rows.length) {
      return NextResponse.json({
        success: true,
        found: false,
        serial,
        order: null,
      });
    }

    const r = rows[0];
    const invoiceNumber =
      String(r.order_invoice_number || "").trim() ||
      String(r.warranty_invoice_number || "").trim() ||
      "";
    const invoiceDate = r.order_invoice_date || r.warranty_invoice_date || null;

    return NextResponse.json({
      success: true,
      found: true,
      serial,
      order: {
        order_id: r.order_id || "",
        quote_number: r.quote_number || "",
        quote_date: r.quote_date || null,
        grand_total: r.grand_total ?? null,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        company_name:
          r.order_company_name ||
          r.quotation_company_name ||
          r.customer_name ||
          "",
        client_name: r.order_client_name || "",
        contact: r.order_contact || "",
        email: r.order_email || "",
        company_address: r.order_company_address || "",
        delivery_location: r.delivery_location || "",
        product_name:
          r.product_name || r.warranty_product_name || "",
        model: r.model || r.warranty_model || r.dispatch_item_code || "",
        dispatch_id: r.dispatch_id ?? null,
      },
    });
  } catch (error) {
    console.error("[amc-cmc/order-by-serial]", error);
    return NextResponse.json(
      { error: "Failed to lookup order for serial" },
      { status: 500 },
    );
  }
}
