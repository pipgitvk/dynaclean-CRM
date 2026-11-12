import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  sqlLikeUtf8Contains,
  sqlTrimUtf8Eq,
  sqlTrimUtf8EqColumns,
} from "@/lib/sqlUtf8Compare";

export const dynamic = "force-dynamic";

function mapOrderRow(r) {
  const invoiceNumber =
    String(r.order_invoice_number || "").trim() ||
    String(r.warranty_invoice_number || "").trim() ||
    "";
  const invoiceDate = r.order_invoice_date || r.warranty_invoice_date || null;

  return {
    order_id: r.order_id || "",
    quote_number: r.quote_number || "",
    quote_date: r.quote_date || null,
    grand_total: r.grand_total ?? null,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    company_name:
      r.order_company_name ||
      r.quotation_company_name ||
      "",
    client_name: r.order_client_name || "",
    contact: r.order_contact || "",
    email: r.order_email || "",
    company_address: r.order_company_address || "",
    delivery_location: r.delivery_location || "",
    product_name: r.product_name || "",
    model: r.model || "",
    serial_number: r.serial_number || "",
    dispatch_id: r.dispatch_id ?? null,
  };
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = String(searchParams.get("order_id") || "").trim();
    const suggestQ = String(searchParams.get("q") || "").trim();

    const conn = await getDbConnection();

    if (suggestQ && !orderId) {
      const [rows] = await conn.execute(
        `SELECT order_id, quote_number, company_name, invoice_number, created_at
         FROM neworder
         WHERE ${sqlLikeUtf8Contains("order_id")}
         ORDER BY created_at DESC
         LIMIT 20`,
        [suggestQ],
      );
      return NextResponse.json({
        success: true,
        suggestions: (rows || []).map((r) => ({
          order_id: r.order_id,
          quote_number: r.quote_number || "",
          company_name: r.company_name || "",
          invoice_number: r.invoice_number || "",
        })),
      });
    }

    if (!orderId) {
      return NextResponse.json(
        { error: "order_id or q is required" },
        { status: 400 },
      );
    }

    const orderIdEq = sqlTrimUtf8Eq("no.order_id", "?");
    const quoteJoin = sqlTrimUtf8EqColumns("d.quote_number", "no.quote_number");
    const quoteOnQr = sqlTrimUtf8EqColumns("qr.quote_number", "no.quote_number");
    const serialOnWp = sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no");
    const qiJoinQuote = sqlTrimUtf8EqColumns("qi.quote_number", "no.quote_number");
    const qiJoinItem = sqlTrimUtf8EqColumns("qi.item_code", "d.item_code");

    const [[orderHead]] = await conn.execute(
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
          qr.company_name AS quotation_company_name
       FROM neworder no
       LEFT JOIN quotations_records qr ON ${quoteOnQr}
       WHERE ${orderIdEq}
       LIMIT 1`,
      [orderId],
    );

    if (!orderHead) {
      return NextResponse.json({
        success: true,
        found: false,
        order_id: orderId,
        order: null,
        machines: [],
      });
    }

    const [machineRows] = await conn.execute(
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
          qr.quote_date,
          qr.grand_total,
          qr.company_name AS quotation_company_name,
          d.id AS dispatch_id,
          d.serial_no AS serial_number,
          d.item_code AS dispatch_item_code,
          qi.item_name AS product_name,
          qi.item_code AS model,
          wp.invoice_number AS warranty_invoice_number,
          wp.invoice_date AS warranty_invoice_date,
          wp.customer_name,
          wp.product_name AS warranty_product_name,
          wp.model AS warranty_model,
          wp.contact AS warranty_contact,
          wp.email AS warranty_email,
          wp.customer_address AS warranty_customer_address,
          wp.installed_address
       FROM neworder no
       INNER JOIN dispatch d ON ${quoteJoin}
       LEFT JOIN quotations_records qr ON ${quoteOnQr}
       LEFT JOIN quotation_items qi
         ON ${qiJoinQuote}
        AND ${qiJoinItem}
       LEFT JOIN warranty_products wp ON ${serialOnWp}
       WHERE ${orderIdEq}
         AND d.serial_no IS NOT NULL
         AND TRIM(d.serial_no) <> ''
       ORDER BY d.id DESC`,
      [orderId],
    );

    const machines = (machineRows || []).map((row) => {
      const base = mapOrderRow({
        ...row,
        model: row.model || row.warranty_model || row.dispatch_item_code,
        product_name: row.product_name || row.warranty_product_name,
      });
      return {
        ...base,
        serial_number: String(row.serial_number || "").trim(),
        customer_name: row.customer_name || row.order_company_name || "",
        contact: row.warranty_contact || row.order_contact || "",
        email: row.warranty_email || row.order_email || "",
        customer_address:
          row.warranty_customer_address || row.order_company_address || "",
        site_address: row.installed_address || row.delivery_location || "",
      };
    });

    const orderSummary = mapOrderRow({
      ...orderHead,
      serial_number: machines[0]?.serial_number || "",
      product_name: machines[0]?.product_name || "",
      model: machines[0]?.model || "",
    });

    return NextResponse.json({
      success: true,
      found: true,
      order_id: orderId,
      order: orderSummary,
      machines,
      machine_count: machines.length,
    });
  } catch (error) {
    console.error("[amc-cmc/order-by-order-id]", error);
    return NextResponse.json(
      { error: "Failed to lookup order" },
      { status: 500 },
    );
  }
}
