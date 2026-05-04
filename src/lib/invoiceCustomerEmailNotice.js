/**
 * Loads invoice rows, builds react-pdf data (same shape as DesignInvoice PDF),
 * renders InvoicePDFDocument server-side, and emails the customer payment + invoice PDF.
 */

import React from "react";
import path from "path";
import fs from "fs";
import { renderToBuffer } from "@react-pdf/renderer";
import InvoicePDFDocument from "@/components/InvoicePdf";
import { sendImportCrmSmtpEmail } from "@/lib/importCrmEmail";

function formatMoneyInr(n) {
  const num = typeof n === "number" ? n : Number(n) || 0;
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function enrichQuoteReference(pool, invoice) {
  let resolvedQuoteNumber = invoice.quotation_id || null;
  let resolvedQuoteCreatedAt = null;
  const qRef = invoice.quotation_id;
  if (!qRef) {
    return { reference_quote_number: resolvedQuoteNumber, reference_quote_created_at: resolvedQuoteCreatedAt };
  }
  try {
    const [[byQuoteNumber]] = await pool.execute(
      `
      SELECT quote_number, created_at
      FROM quotations_records
      WHERE TRIM(quote_number) = TRIM(?)
      LIMIT 1
      `,
      [String(qRef)],
    );

    if (byQuoteNumber?.quote_number) {
      resolvedQuoteNumber = byQuoteNumber.quote_number;
      resolvedQuoteCreatedAt = byQuoteNumber.created_at || null;
    } else {
      const [[byLegacyId]] = await pool.execute(
        `
        SELECT quote_number, created_at
        FROM quotations_records
        WHERE TRIM(CAST(\`S.No.\` AS CHAR)) = TRIM(?)
        LIMIT 1
        `,
        [String(qRef)],
      );
      if (byLegacyId?.quote_number) {
        resolvedQuoteNumber = byLegacyId.quote_number;
        resolvedQuoteCreatedAt = byLegacyId.created_at || null;
      }
    }
  } catch {
    /* keep fallback */
  }

  if (resolvedQuoteNumber && !resolvedQuoteCreatedAt) {
    try {
      const [[q]] = await pool.execute(
        `
        SELECT created_at
        FROM quotations_records
        WHERE TRIM(quote_number) = TRIM(?)
        LIMIT 1
        `,
        [String(resolvedQuoteNumber)],
      );
      resolvedQuoteCreatedAt = q?.created_at || null;
    } catch {
      /* ignore */
    }
  }

  return {
    reference_quote_number: resolvedQuoteNumber,
    reference_quote_created_at: resolvedQuoteCreatedAt,
  };
}

export async function loadInvoiceWithItemsForPdf(pool, invoiceId) {
  const id = Number(invoiceId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const [[invoice]] = await pool.execute(`SELECT * FROM invoices WHERE id = ? LIMIT 1`, [id]);
  if (!invoice) return null;
  const [items] = await pool.execute(
    `SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC`,
    [id],
  );
  const quote = await enrichQuoteReference(pool, invoice);
  return { ...invoice, ...quote, items: items || [] };
}

function calculateTaxRate(invoice) {
  if (invoice.subtotal && Number(invoice.subtotal) > 0) {
    if (invoice.igst && Number(invoice.igst) > 0) {
      return ((Number(invoice.igst) / Number(invoice.subtotal)) * 100).toFixed(2);
    }
    if (invoice.cgst && Number(invoice.cgst) > 0) {
      return ((Number(invoice.cgst) / Number(invoice.subtotal)) * 100).toFixed(2);
    }
  }
  return "0.00";
}

function parseTerms(raw) {
  if (!raw) return [];
  return String(raw)
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Same structure as DesignInvoice.jsx `data` for InvoicePDFDocument */
export function buildInvoicePdfDocumentData(invoice) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const createItemsArray = () => {
    if (items.length) {
      return items.map((item, index) => ({
        sr_no: index + 1,
        description: item.item_name,
        fullDescription: item.description || "",
        hsn: item.hsn_code || "",
        quantity: parseFloat(item.quantity) || 1,
        rate: parseFloat(item.rate) || 0,
        discount_percent: parseFloat(item.discount_percent) || 0,
        discount_amount: parseFloat(item.discount_amount) || 0,
        taxable_value: parseFloat(item.taxable_value) || 0,
        cgst_percent: parseFloat(item.cgst_percent) || 0,
        sgst_percent: parseFloat(item.sgst_percent) || 0,
        igst_percent: parseFloat(item.igst_percent) || 0,
        cgst_amount: parseFloat(item.cgst_amount) || 0,
        sgst_amount: parseFloat(item.sgst_amount) || 0,
        igst_amount: parseFloat(item.igst_amount) || 0,
        total_amount: parseFloat(item.total_amount) || 0,
        amount: parseFloat(item.taxable_value) || 0,
      }));
    }
    return [
      {
        sr_no: 1,
        description: "Invoice Amount",
        fullDescription: "",
        hsn: "",
        quantity: 1,
        rate: invoice.subtotal || 0,
        amount: invoice.subtotal || 0,
      },
    ];
  };

  let itemTotals;
  if (!invoice.items?.length) {
    itemTotals = {
      subtotal: Number(invoice.subtotal) || 0,
      totalTax: Number(invoice.total_tax) || 0,
      grandTotal: Number(invoice.grand_total) || 0,
      totalCGST: Number(invoice.cgst) || 0,
      totalSGST: Number(invoice.sgst) || 0,
      totalIGST: Number(invoice.igst) || 0,
      totalQuantity: 1,
    };
  } else {
    itemTotals = {
      subtotal: 0,
      totalTax: 0,
      grandTotal: 0,
      totalCGST: 0,
      totalSGST: 0,
      totalIGST: 0,
      totalQuantity: 0,
    };
    items.forEach((item) => {
      itemTotals.subtotal += parseFloat(item.taxable_value) || 0;
      itemTotals.totalCGST += parseFloat(item.cgst_amount) || 0;
      itemTotals.totalSGST += parseFloat(item.sgst_amount) || 0;
      itemTotals.totalIGST += parseFloat(item.igst_amount) || 0;
      itemTotals.totalTax +=
        (parseFloat(item.cgst_amount) || 0) +
        (parseFloat(item.sgst_amount) || 0) +
        (parseFloat(item.igst_amount) || 0);
      itemTotals.grandTotal += parseFloat(item.total_amount) || 0;
      itemTotals.totalQuantity += parseFloat(item.quantity) || 0;
    });
    const roundOff = parseFloat(invoice.round_off) || 0;
    itemTotals.grandTotal += roundOff;
  }

  const itemsArray = createItemsArray();
  const invo = invoice;

  const paymentRaw = invo.payment_status || "UNPAID";
  const paymentLabel =
    paymentRaw === "PAID" ? "PAID" : paymentRaw === "PARTIAL" ? "PARTIAL" : "UNPAID";

  return {
    company: {
      name: "Dynaclean Industries Pvt Ltd",
      address:
        "1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road, Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu - 641006",
      phone: "011-45143666, +91-7982456944",
      email: "sales@dynacleanindustries.com",
      gstin: "07AAKCD6495M1ZV",
    },
    buyer: {
      name: invo.customer_name || "",
      address: invo.billing_address || "",
      gstin: invo.gst_number || "",
      state: invo.state || "",
      placeOfSupply: invo.state || "",
      contactPerson: invo.customer_name || "",
      phone: invo.customer_phone || "",
      email: invo.customer_email || "",
    },
    consignee: {
      name: invo.Consignee || invo.customer_name || "",
      address: invo.shipping_address || invo.billing_address || "",
      gstin: invo.gst_number || "",
      state: invo.state || "",
      contactPerson: invo.customer_name || "",
      phone: invo.Consignee_Contact || "",
    },
    invoice: {
      number: invo.invoice_number || "",
      buyersOrderNo: invo.buyers_order_no || "",
      eWayBill: invo.eway_bill_no || "",
      deliveryChallanNo: invo.delivery_challan_no || "",
      referenceNo: invo.reference_quote_number || invo.quotation_id || "",
      stateCode:
        invo.state_code != null && String(invo.state_code).trim() !== ""
          ? String(invo.state_code).trim()
          : (invo.gst_number || "").slice(0, 2),
      referenceDate: invo.reference_quote_created_at
        ? new Date(invo.reference_quote_created_at)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
            .replace(/ /g, "-")
        : "",
      invoiceDate: invo.created_at
        ? new Date(invo.created_at)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
            .replace(/ /g, "-")
        : invo.invoice_date
          ? new Date(invo.invoice_date)
              .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "2-digit",
              })
              .replace(/ /g, "-")
          : "",
      orderDate: invo.order_date
        ? new Date(invo.order_date)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
            .replace(/ /g, "-")
        : invo.invoice_date
          ? new Date(invo.invoice_date)
              .toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "2-digit",
              })
              .replace(/ /g, "-")
          : "",
      dueDate: invo.due_date
        ? new Date(invo.due_date)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
            .replace(/ /g, "-")
        : "",
    },
    items: itemsArray,
    taxRate: calculateTaxRate(invo),
    taxAmount:
      parseFloat(itemTotals.totalTax)?.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) || "0.00",
    roundOff: parseFloat(invoice.round_off) || 0,
    total:
      parseFloat(itemTotals.grandTotal)?.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) || "0.00",
    subtotal:
      parseFloat(itemTotals.subtotal)?.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) || "0.00",
    cgst:
      parseFloat(itemTotals.totalCGST)?.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) || "0.00",
    sgst:
      parseFloat(itemTotals.totalSGST)?.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) || "0.00",
    igst:
      parseFloat(itemTotals.totalIGST)?.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) || "0.00",
    amountInWords: "Not Available",
    taxAmountInWords: "Not Available",
    terms: parseTerms(invo.terms_conditions),
    notes: invo.notes || "",
    bank: {
      accountHolderName: "Dynaclean Industries Private Limited",
      name: "ICICI Bank",
      accountNo: "343405500379",
      IFSC: "ICIC0003434",
    },
    paymentInfo: {
      status: paymentLabel,
      amountPaid: formatMoneyInr(invo.amount_paid),
      balanceAmount: formatMoneyInr(invo.balance_amount),
    },
  };
}

function pickExistingPublicAsset(relativeNames) {
  const base = path.join(process.cwd(), "public");
  for (const n of relativeNames) {
    const p = path.join(base, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function mimeForImagePath(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

/**
 * react-pdf often cannot load file:// or HTTP from Node (serverless, workers).
 * Data URIs embed bytes and match the on-screen invoice assets from /public.
 */
function publicAssetToDataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  try {
    const buf = fs.readFileSync(filePath);
    const mime = mimeForImagePath(filePath);
    if (mime === "application/octet-stream") return undefined;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function renderInvoicePdfBuffer(invWithItems) {
  const data = buildInvoicePdfDocumentData(invWithItems);
  const logoPath = pickExistingPublicAsset(["logo1.jpg", "logo.jpg", "logo.png"]);
  const sigPath = pickExistingPublicAsset(["s.png"]);
  const logoSrc = publicAssetToDataUri(logoPath);
  const signatureSrc = publicAssetToDataUri(sigPath);
  const element = React.createElement(InvoicePDFDocument, {
    data,
    logoSrc,
    signatureSrc,
  });
  return renderToBuffer(element);
}

function statusLabelFriendly(code) {
  if (code === "PAID") return "Paid in full";
  if (code === "PARTIAL") return "Partially paid";
  return "Unpaid";
}

/**
 * Sends payment notice + invoice PDF. Does not throw on SMTP failure —
 * caller can log; returns structured result for API response.
 */
export async function sendInvoicePaymentNoticeEmail(invWithItems) {
  const to = String(invWithItems.customer_email || "").trim();
  const invNum = String(invWithItems.invoice_number || "").trim();

  const amountPaidNum = Number(invWithItems.amount_paid) || 0;
  const grandTotalNum = Number(invWithItems.grand_total) || 0;
  const balanceRaw = Number(invWithItems.balance_amount);
  const balanceNum = Number.isFinite(balanceRaw)
    ? balanceRaw
    : Math.max(0, grandTotalNum - amountPaidNum);
  const statusCode = invWithItems.payment_status || "UNPAID";

  if (!to) {
    return { sent: false, skipped: true, reason: "missing_customer_email" };
  }

  try {
    const pdfBuffer = await renderInvoicePdfBuffer(invWithItems);
    const safeName = invNum.replace(/[/\\?%*:|"<>]/g, "_") || String(invWithItems.id);

    const subj = `Invoice ${invNum ? invNum : ""} — payment / invoice update from Dynaclean Industries`;

    const paidLine =
      amountPaidNum > 0
        ? `We have updated our records for invoice <strong>${invNum}</strong> — payment recorded: <strong>₹${formatMoneyInr(amountPaidNum)}</strong>.`
        : `Please find invoice <strong>${invNum}</strong> attached. Payment recorded to date: <strong>₹${formatMoneyInr(0)}</strong>.`;

    const cust = invWithItems.customer_name?.trim()
      ? invWithItems.customer_name.trim()
      : "Customer";
    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
        <p>Hello ${cust},</p>
        <p>${paidLine}</p>
        <p>
          Invoice total: <strong>₹${formatMoneyInr(grandTotalNum)}</strong><br/>
          Balance remaining: <strong>₹${formatMoneyInr(balanceNum)}</strong><br/>
          Payment status (per our records): <strong>${statusLabelFriendly(statusCode)}</strong>
        </p>
        <p>A copy of the invoice is attached as a PDF. If you have any questions, please contact us.</p>
        <p>Regards,<br/>Dynaclean Industries</p>
      </div>
    `.trim();

    await sendImportCrmSmtpEmail({
      to,
      subject: subj.trim(),
      html,
      attachments: [
        {
          filename: `Invoice-${safeName}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return { sent: true };
  } catch (err) {
    console.error("sendInvoicePaymentNoticeEmail:", err?.message || err);
    return { sent: false, error: err?.message || String(err) };
  }
}
