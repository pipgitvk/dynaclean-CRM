// "use client"
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
// import logo from "./logo1.jpg";
import { numberToWords } from "@/utils/NumbertoWord";

/**
 * @react-pdf/image resolves URLs in its own context. In the browser, relative `/file.jpg`
 * paths usually fail — prefer `https://your-host/...`. For email PDF on the server, pass
 * embedded `data:image/...;base64,...` URIs (see `invoiceCustomerEmailNotice.js`).
 */
function resolveInvoicePdfImageSrc(propSrc, fallbackPublicPath = "") {
  const tryResolve = (s) => {
    const raw = typeof s === "string" ? s.trim() : "";
    if (!raw) return "";
    if (/^data:/i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw) || /^file:/i.test(raw)) return raw;
    if (/^[a-zA-Z]:[\\/]/.test(raw)) return raw;
    if (
      typeof window !== "undefined" &&
      raw.startsWith("/") &&
      raw.length > 1
    ) {
      try {
        return `${window.location.origin}${raw}`;
      } catch {
        return "";
      }
    }
    return raw;
  };
  let out = tryResolve(propSrc);
  if (out) return out;
  out = tryResolve(fallbackPublicPath);
  /** Node / SSR: bare "/public/path" fallback is unreadable — skip unless browser above. */
  if (typeof window === "undefined" && out.startsWith("/")) return "";
  return out;
}

// Register fonts - using Roboto from cdnjs (more reliable)
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf",
      fontWeight: 300,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf",
      fontWeight: 500,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      fontWeight: 700,
    },
  ],
});

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 10,
    paddingTop: 20,
    paddingBottom: 20,
    fontSize: 9,
    fontFamily: "Roboto",
    backgroundColor: "#fff",
    width: "100%",
  },
  container: {
    border: "1px solid #000",
    padding: 10,
    width: "100%",
  },
  invoiceTitleOutside: {
    width: "100%",
    textAlign: "center",
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
  },
  // Company Details
  companyContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logoContainer: {
    width: "30%",
  },
  logo: {
    width: 120,
    height: 110,
  },
  companyDetails: {
    width: "70%",
    textAlign: "center",
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 2,
  },
  companyText: {
    fontSize: 10,
    marginBottom: 1,
    lineHeight: 1.2,
  },
  companyDetailText: {
    fontSize: 11,
    marginBottom: 2,
    lineHeight: 1.45,
    fontWeight: 400,
  },
  // Tables
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 10,
    flexDirection: "column",
    flexShrink: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    minHeight: 24,
  },
  tableCell: {
    padding: "4px",
    border: "1px solid #000",
    fontSize: 9,
  },
  tableHeader: {
    backgroundColor: "#f0f0f0",
    fontWeight: 700,
  },
  // Sections
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: 700,
    marginBottom: 4,
    fontSize: 9,
  },
  // Text styles
  bold: {
    fontWeight: 700,
  },
  rightAlign: {
    textAlign: "right",
  },
  centerAlign: {
    textAlign: "center",
  },
  leftAlign: {
    textAlign: "left",
  },
  // Items table
  descriptionCell: {
    padding: "4px",
    border: "1px solid #000",
  },
  descriptionText: {
    fontWeight: 700,
    marginBottom: 2,
  },
  descriptionSubtext: {
    fontSize: 8,
    marginTop: 2,
    lineHeight: 1.2,
  },
  // Tax summary
  taxSummaryRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    minHeight: 20,
  },
  // Footer
  termsBankContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  termsContainer: {
    flex: 1,
    marginRight: 10,
  },
  bankContainer: {
    width: 250,
  },
  signature: {
    marginTop: 40,
    textAlign: "right",
  },
  footer: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 8,
  },
});

// Helper function to format currency
const formatCurrency = (value) => {
  if (!value && value !== 0) return "0.00";
  const num = parseFloat(value);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatInvoiceTaxRatePct = (raw) => {
  const n = parseFloat(String(raw ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

// Helper function to calculate tax rows
const renderTaxRows = (data, itemTotals) => {
  const rows = [];
  const trx = formatInvoiceTaxRatePct(data.taxRate);

  if (parseFloat(itemTotals.totalIGST) > 0) {
    rows.push(
      <View key="igst" style={styles.tableRow}>
        <Text
          style={[
            styles.tableCell,
            { width: "83.33%", textAlign: "right", fontWeight: 700 },
          ]}
        >
          Output IGST {trx}%
        </Text>
        <Text
          style={[styles.tableCell, { width: "16.67%", textAlign: "right" }]}
        >
          {data.igst}
        </Text>
      </View>,
    );
  } else {
    if (parseFloat(itemTotals.totalCGST) > 0) {
      rows.push(
        <View key="cgst" style={styles.tableRow}>
          <Text
            style={[
              styles.tableCell,
              { width: "83.33%", textAlign: "right", fontWeight: 700 },
            ]}
          >
            Output CGST {trx}%
          </Text>
          <Text
            style={[styles.tableCell, { width: "16.67%", textAlign: "right" }]}
          >
            {data.cgst}
          </Text>
        </View>,
      );
    }

    if (parseFloat(itemTotals.totalSGST) > 0) {
      rows.push(
        <View key="sgst" style={styles.tableRow}>
          <Text
            style={[
              styles.tableCell,
              { width: "83.33%", textAlign: "right", fontWeight: 700 },
            ]}
          >
            Output SGST {trx}%
          </Text>
          <Text
            style={[styles.tableCell, { width: "16.67%", textAlign: "right" }]}
          >
            {data.sgst}
          </Text>
        </View>,
      );
    }
  }

  return rows;
};

// Helper to build HSN summary
const buildHSNSummary = (items, itemTotals) => {
  const map = {};

  items.forEach((item) => {
    const hsn = item.hsn || "NA";
    if (!map[hsn]) {
      map[hsn] = {
        hsn,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cgstPercent: item.cgst_percent,
        sgstPercent: item.sgst_percent,
        igstPercent: item.igst_percent,
      };
    }

    map[hsn].taxableValue += parseFloat(item.amount || 0);
    map[hsn].cgst += parseFloat(item.cgst_amount || 0);
    map[hsn].sgst += parseFloat(item.sgst_amount || 0);
    map[hsn].igst += parseFloat(item.igst_amount || 0);
  });

  return Object.values(map);
};

// Main PDF Document Component
/** logoSrc: absolute path on server for PDF. signatureSrc: stamp/signature image (e.g. public/s.png). */
const InvoicePDFDocument = ({ data, logoSrc, signatureSrc }) => {
  const logoPdfSrc = resolveInvoicePdfImageSrc(logoSrc, "/logo1.jpg");
  const signaturePdfSrc = resolveInvoicePdfImageSrc(signatureSrc, "/s.png");
  // Calculate item totals
  const calculateItemTotals = () => {
    const totals = {
      subtotal: 0,
      totalTax: 0,
      grandTotal: 0,
      totalCGST: 0,
      totalSGST: 0,
      totalIGST: 0,
      totalQuantity: 0,
    };

    data.items.forEach((item) => {
      totals.subtotal += parseFloat(item.amount || 0);
      totals.totalCGST += parseFloat(item.cgst_amount || 0);
      totals.totalSGST += parseFloat(item.sgst_amount || 0);
      totals.totalIGST += parseFloat(item.igst_amount || 0);
      totals.totalTax +=
        (parseFloat(item.cgst_amount) || 0) +
        (parseFloat(item.sgst_amount) || 0) +
        (parseFloat(item.igst_amount) || 0);
      totals.grandTotal += parseFloat(item.total_amount || item.amount || 0);
      totals.totalQuantity += parseFloat(item.quantity || 1);
    });

    return totals;
  };

  const itemTotals = calculateItemTotals();
  const hsnSummary = buildHSNSummary(data.items, itemTotals);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.invoiceTitleOutside}>
          <Text style={styles.headerTitle}>Tax Invoice</Text>
        </View>
        <View style={styles.container}>
          {/* Logo + company (matches DesignInvoice: 25% / 75%) */}
          <View style={styles.table}>
            <View
              style={{
                flexDirection: "row",
                borderBottom: "1px solid #000",
                alignItems: "flex-start",
                flexShrink: 0,
              }}
            >
              <View
                style={[
                  styles.tableCell,
                  {
                    width: "25%",
                    padding: 8,
                    paddingTop: 14,
                    flexShrink: 0,
                  },
                ]}
              >
                {logoPdfSrc ? (
                  <Image
                    src={logoPdfSrc}
                    style={{
                      width: 110,
                      height: 62,
                      objectFit: "contain",
                      marginLeft: 32,
                    }}
                  />
                ) : (
                  <View style={{ width: 110, height: 62, marginLeft: 32 }} />
                )}
              </View>
              <View
                style={[
                  styles.tableCell,
                  {
                    width: "75%",
                    padding: 8,
                    flexShrink: 0,
                  },
                ]}
              >
                <Text style={[styles.companyName, { textAlign: "center" }]}>
                  {data.company?.name || ""}
                </Text>
                <Text
                  style={[styles.companyDetailText, { textAlign: "center" }]}
                >
                  {[
                    data.company?.addressLine1 ?? data.company?.address ?? "",
                    data.company?.addressLine2 || "",
                    `Ph: ${data.company?.phone || ""}`,
                    `GST: ${data.company?.gstin || ""}`,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                </Text>
              </View>
            </View>

            {/* Invoice metadata — inline labels like print view */}
            <View style={styles.tableRow}>
              <View style={[styles.tableCell, { width: "33.33%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>Invoice No. : </Text>
                  <Text>{data.invoice.number || "-"}</Text>
                </Text>
              </View>
              <View style={[styles.tableCell, { width: "33.33%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>Invoice Date : </Text>
                  <Text>{data.invoice.invoiceDate || "-"}</Text>
                </Text>
              </View>
              <View style={[styles.tableCell, { width: "33.34%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>Due Date : </Text>
                  <Text>{data.invoice.dueDate || "-"}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.tableRow}>
              <View style={[styles.tableCell, { width: "33.33%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9, lineHeight: 1.35 }}>
                  <Text style={styles.bold}>Reference No. : </Text>
                  <Text>{data.invoice.referenceNo || "-"}</Text>
                  {"\n"}
                  <Text style={styles.bold}>Date : </Text>
                  <Text>{data.invoice.referenceDate || "-"}</Text>
                </Text>
              </View>
              <View style={[styles.tableCell, { width: "33.33%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>Buyer&apos;s Order No. : </Text>
                  <Text>{data.invoice.buyersOrderNo || "-"}</Text>
                </Text>
              </View>
              <View style={[styles.tableCell, { width: "33.34%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>Order Date : </Text>
                  <Text>{data.invoice.orderDate || "-"}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.tableRow}>
              <View style={[styles.tableCell, { width: "33.33%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>e-Way Bill No. : </Text>
                  <Text>{data.invoice.eWayBill || "-"}</Text>
                </Text>
              </View>
              <View style={[styles.tableCell, { width: "33.33%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>Payment Status : </Text>
                  <Text>{data.paymentInfo.status || "-"}</Text>
                </Text>
              </View>
              <View style={[styles.tableCell, { width: "33.34%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>Balance Amount : </Text>
                  <Text>{data.paymentInfo.balanceAmount || "0.00"}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.tableRow}>
              <View style={[styles.tableCell, { width: "100%", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 9 }}>
                  <Text style={styles.bold}>Delivery Challan No. : </Text>
                  <Text>{data.invoice.deliveryChallanNo || "-"}</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Buyer | Consignee — 50 / 50 like print view */}
          <View style={styles.section}>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: "50%", padding: 8 }]}>
                  <Text style={[styles.bold, { fontSize: 9, marginBottom: 4 }]}>
                    Buyer (Bill To) : {data.buyer.name || "-"}
                  </Text>
                  <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>Address: </Text>
                    <Text>{data.buyer.address || "-"}</Text>
                  </Text>
                  <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>GSTIN: </Text>
                    <Text>{data.buyer.gstin || "22AAAAA0000A1Z5"}</Text>
                    <Text>   </Text>
                    <Text style={styles.bold}>State: </Text>
                    <Text>{data.buyer.state || "-"}</Text>
                  </Text>
                  <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>Place of Supply: </Text>
                    <Text>{data.buyer.placeOfSupply || "-"}</Text>
                  </Text>
                  <Text style={{ fontSize: 9, marginBottom: 2, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>Contact: </Text>
                    <Text>{data.buyer.contactPerson || "-"}</Text>
                    <Text> ({data.buyer.phone || "-"})</Text>
                  </Text>
                  <Text style={{ fontSize: 9, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>Email: </Text>
                    <Text>{data.buyer.email || "-"}</Text>
                  </Text>
                </View>

                <View style={[styles.tableCell, { width: "50%", padding: 8 }]}>
                  <Text style={[styles.bold, { fontSize: 9, marginBottom: 4 }]}>
                    Consignee (Ship To) : {data.consignee.name || "-"}
                  </Text>
                  <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>Address: </Text>
                    <Text>{data.consignee.address || "-"}</Text>
                  </Text>
                  <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>GSTIN: </Text>
                    <Text>{data.consignee.gstin || "22AAAAA0000A1Z5"}</Text>
                  </Text>
                  <Text style={{ fontSize: 9, marginBottom: 3, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>State: </Text>
                    <Text>{data.consignee.state || "-"}</Text>
                  </Text>
                  <Text style={{ fontSize: 9, lineHeight: 1.4 }}>
                    <Text style={styles.bold}>Contact: </Text>
                    <Text>{data.consignee.contactPerson || "-"}</Text>
                    <Text> ({data.consignee.phone || "-"})</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* State code, amount paid, notes */}
          <View style={styles.section}>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: "50%", paddingVertical: 6 }]}>
                  <Text style={{ fontSize: 9 }}>
                    <Text style={styles.bold}>State Code : </Text>
                    <Text>{data.invoice.stateCode || ""}</Text>
                  </Text>
                </View>
                <View style={[styles.tableCell, { width: "50%", paddingVertical: 6 }]}>
                  <Text style={{ fontSize: 9 }}>
                    <Text style={styles.bold}>Amount Paid : </Text>
                    <Text>₹{data.paymentInfo.amountPaid || "0.00"}</Text>
                  </Text>
                </View>
              </View>
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, { width: "100%", paddingVertical: 6 }]}>
                  <Text style={{ fontSize: 9 }}>
                    <Text style={styles.bold}>Notes : </Text>
                    <Text>{data.notes || ""}</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Items Table */}
          <View style={styles.section}>
            <View style={styles.table}>
              {/* Table Header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, { width: "8%" }]}>Sl No.</Text>
                <Text style={[styles.tableCell, { width: "35%" }]}>
                  Description of Goods
                </Text>
                <Text style={[styles.tableCell, { width: "12%" }]}>
                  HSN/SAC
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "12%", textAlign: "center" },
                  ]}
                >
                  Quantity
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "16%", textAlign: "right" },
                  ]}
                >
                  Rate
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "17%", textAlign: "right" },
                  ]}
                >
                  Amount
                </Text>
              </View>

              {/* Table Rows */}
              {data.items.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: "8%" }]}>
                    {item.sr_no || index + 1}
                  </Text>
                  <View style={[styles.descriptionCell, { width: "35%" }]}>
                    <Text style={styles.descriptionText}>
                      {item.description}
                    </Text>
                    {item.fullDescription && (
                      <Text style={styles.descriptionSubtext}>
                        {item.fullDescription}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.tableCell, { width: "12%" }]}>
                    {item.hsn}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: "12%", textAlign: "center" },
                    ]}
                  >
                    {item.quantity}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: "16%", textAlign: "right" },
                    ]}
                  >
                    {formatCurrency(item.rate)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: "17%", textAlign: "right" },
                    ]}
                  >
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))}

              {/* Tax Rows */}
              {renderTaxRows(data, itemTotals)}

              {/* Total Row */}
              <View style={[styles.tableRow, { fontWeight: 700 }]}>
                <Text style={[styles.tableCell, { width: "55%" }]}>Total</Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "12%", textAlign: "center" },
                  ]}
                >
                  {itemTotals.totalQuantity}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "16%", textAlign: "right" },
                  ]}
                >
                  ₹
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "17%", textAlign: "right" },
                  ]}
                >
                  {data.total}
                </Text>
              </View>
            </View>
          </View>

          {/* Amount in Words */}
          <View style={[styles.section, { marginBottom: 10 }]}>
            <Text style={{ fontSize: 9, marginBottom: 4 }}>
              <Text style={styles.bold}>
                Amount Chargeable (in words) E. &amp; O.E
              </Text>
            </Text>
            <Text style={[styles.bold, { fontSize: 9 }]}>
              INR- {numberToWords(data.total)}
            </Text>
          </View>

          {/* Tax Summary Table */}
          <View style={styles.section}>
            <View style={styles.table}>
              {/* Table Header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, { width: "15%" }]}>
                  HSN/SAC
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "20%", textAlign: "right" },
                  ]}
                >
                  Taxable Value
                </Text>
                {parseFloat(itemTotals.totalIGST) > 0 ? (
                  <>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "10%", textAlign: "center" },
                      ]}
                    >
                      IGST
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "10%", textAlign: "center" },
                      ]}
                    >
                      Rate
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "15%", textAlign: "right" },
                      ]}
                    >
                      Amount
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "15%", textAlign: "right" },
                      ]}
                    >
                      Total Tax Amount
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "8%", textAlign: "center" },
                      ]}
                    >
                      CGST
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "7%", textAlign: "center" },
                      ]}
                    >
                      Rate
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "10%", textAlign: "right" },
                      ]}
                    >
                      Amount
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "8%", textAlign: "center" },
                      ]}
                    >
                      SGST/UTGST
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "7%", textAlign: "center" },
                      ]}
                    >
                      Rate
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "10%", textAlign: "right" },
                      ]}
                    >
                      Amount
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "15%", textAlign: "right" },
                      ]}
                    >
                      Total Tax Amount
                    </Text>
                  </>
                )}
              </View>

              {/* HSN Rows */}
              {hsnSummary.map((row, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: "15%" }]}>
                    {row.hsn}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: "20%", textAlign: "right" },
                    ]}
                  >
                    {formatCurrency(row.taxableValue)}
                  </Text>

                  {parseFloat(itemTotals.totalIGST) > 0 ? (
                    <>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "10%", textAlign: "center" },
                        ]}
                      >
                        IGST
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "10%", textAlign: "center" },
                        ]}
                      >
                        {formatInvoiceTaxRatePct(row.igstPercent)}%
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "15%", textAlign: "right" },
                        ]}
                      >
                        {formatCurrency(row.igst)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "15%", textAlign: "right" },
                        ]}
                      >
                        {formatCurrency(row.igst)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "8%", textAlign: "center" },
                        ]}
                      >
                        CGST
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "7%", textAlign: "center" },
                        ]}
                      >
                        {formatInvoiceTaxRatePct(row.cgstPercent)}%
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "10%", textAlign: "right" },
                        ]}
                      >
                        {formatCurrency(row.cgst)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "8%", textAlign: "center" },
                        ]}
                      >
                        SGST/UTGST
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "7%", textAlign: "center" },
                        ]}
                      >
                        {formatInvoiceTaxRatePct(row.sgstPercent)}%
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "10%", textAlign: "right" },
                        ]}
                      >
                        {formatCurrency(row.sgst)}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { width: "15%", textAlign: "right" },
                        ]}
                      >
                        {formatCurrency(row.cgst + row.sgst)}
                      </Text>
                    </>
                  )}
                </View>
              ))}

              {/* Total Row */}
              <View style={[styles.tableRow, { fontWeight: 700 }]}>
                <Text style={[styles.tableCell, { width: "15%" }]}>Total</Text>
                <Text
                  style={[
                    styles.tableCell,
                    { width: "20%", textAlign: "right" },
                  ]}
                >
                  {data.subtotal}
                </Text>
                {parseFloat(itemTotals.totalIGST) > 0 ? (
                  <>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "20%", textAlign: "center" },
                      ]}
                    ></Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "15%", textAlign: "right" },
                      ]}
                    >
                      {data.igst}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "15%", textAlign: "right" },
                      ]}
                    >
                      {data.taxAmount}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "15%", textAlign: "center" },
                      ]}
                    ></Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "10%", textAlign: "right" },
                      ]}
                    >
                      {data.cgst}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "15%", textAlign: "center" },
                      ]}
                    ></Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "10%", textAlign: "right" },
                      ]}
                    >
                      {data.sgst}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "15%", textAlign: "right" },
                      ]}
                    >
                      {data.taxAmount}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Tax Amount in Words + Round off (aligned like print view) */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 15,
              width: "100%",
            }}
          >
            <Text style={[styles.bold, { fontSize: 9, flex: 1, paddingRight: 8 }]}>
              Tax Amount (in words) : INR- {numberToWords(data.taxAmount)}
            </Text>
            {data.roundOff !== 0 && data.roundOff != null ? (
              <Text style={[styles.bold, { fontSize: 9 }]}>
                Round Off:{" "}
                {data.roundOff > 0
                  ? `+₹${Math.abs(Number(data.roundOff)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                  : `-₹${Math.abs(Number(data.roundOff)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              </Text>
            ) : null}
          </View>

          {/* Terms & Bank Details */}
          <View style={styles.termsBankContainer}>
            <View style={styles.termsContainer}>
              <Text style={styles.sectionTitle}>Terms & Condition</Text>
              {data.terms.length > 0 ? (
                data.terms.map((term, index) => (
                  <Text key={index} style={{ marginBottom: 3 }}>
                    {term}
                  </Text>
                ))
              ) : (
                <Text>No terms and conditions specified.</Text>
              )}
            </View>
            <View style={styles.bankContainer}>
              <Text style={styles.sectionTitle}>Company's Bank Details</Text>
              <Text>A/C Holder Name : {data.bank.accountHolderName}</Text>
              <Text>Bank Name : {data.bank.name}</Text>
              <Text>A/c No. : {data.bank.accountNo}</Text>
              <Text>Branch & IFS Code: {data.bank.IFSC}</Text>
            </View>
          </View>

          {/* Signature */}
          <View style={styles.signature}>
            <Text style={{ fontSize: 9 }}>for {data.company.name}</Text>
            <View style={{ alignItems: "flex-end", marginTop: 10 }}>
              {signaturePdfSrc ? (
                <Image
                  src={signaturePdfSrc}
                  style={{
                    width: 120,
                    height: 60,
                    objectFit: "contain",
                  }}
                />
              ) : (
                <View style={{ width: 120, height: 60 }} />
              )}
            </View>
            <Text style={[styles.bold, { marginTop: 8, fontSize: 9 }]}>
              Authorised Signatory
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text>This is a Computer Generated Invoice</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default InvoicePDFDocument;
