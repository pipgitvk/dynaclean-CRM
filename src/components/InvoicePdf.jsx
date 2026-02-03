"use client"
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register fonts (optional - for better typography)
Font.register({
  family: "Arial",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/arial/v12/9kDpJVQ0S4zCJSZEH7HnVQ.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/s/arial/v12/4UaCrEVJchcbVhT6qLCJng.ttf",
      fontWeight: "bold",
    },
  ],
});

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: "Arial",
    backgroundColor: "#fff",
    width: "100%",
  },
  container: {
    border: "1px solid #000",
    padding: 28,
    width: "100%",
    minHeight: "100%",
  },
  // Header
  header: {
    textAlign: "center",
    borderBottom: "2px solid #000",
    paddingBottom: 5,
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "bold",
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
    fontWeight: "bold",
    marginBottom: 2,
  },
  companyText: {
    fontSize: 10,
    marginBottom: 1,
    lineHeight: 1.2,
  },
  // Tables
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: 10,
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
    fontWeight: "bold",
  },
  // Sections
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 4,
    fontSize: 9,
  },
  // Text styles
  bold: {
    fontWeight: "bold",
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
    fontWeight: "bold",
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
    fontStyle: "italic",
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

// Helper function to calculate tax rows
const renderTaxRows = (data, itemTotals) => {
  const rows = [];
  
  if (parseFloat(itemTotals.totalIGST) > 0) {
    rows.push(
      <View key="igst" style={styles.tableRow}>
        <Text style={[styles.tableCell, { width: "83.33%", textAlign: "right", fontWeight: "bold" }]}>
          Output IGST {data.taxRate}%
        </Text>
        <Text style={[styles.tableCell, { width: "16.67%", textAlign: "right" }]}>
          {data.igst}
        </Text>
      </View>
    );
  } else {
    if (parseFloat(itemTotals.totalCGST) > 0) {
      rows.push(
        <View key="cgst" style={styles.tableRow}>
          <Text style={[styles.tableCell, { width: "83.33%", textAlign: "right", fontWeight: "bold" }]}>
            Output CGST {data.taxRate}%
          </Text>
          <Text style={[styles.tableCell, { width: "16.67%", textAlign: "right" }]}>
            {data.cgst}
          </Text>
        </View>
      );
    }

    if (parseFloat(itemTotals.totalSGST) > 0) {
      rows.push(
        <View key="sgst" style={styles.tableRow}>
          <Text style={[styles.tableCell, { width: "83.33%", textAlign: "right", fontWeight: "bold" }]}>
            Output SGST {data.taxRate}%
          </Text>
          <Text style={[styles.tableCell, { width: "16.67%", textAlign: "right" }]}>
            {data.sgst}
          </Text>
        </View>
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
const InvoicePDFDocument = ({ data }) => {
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
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tax Invoice</Text>
          </View>

          {/* Company Details */}
          <View style={styles.companyContainer}>
            <View style={styles.logoContainer}>
              {/* Note: React PDF Image requires a static source or base64 */}
              <Text>[Company Logo]</Text>
            </View>
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{data.company.name}</Text>
              <Text style={styles.companyText}>{data.company.address}</Text>
              <Text style={styles.companyText}>{data.company.phone}</Text>
              <Text style={styles.companyText}>GST: {data.company.gstin}</Text>
            </View>
            <View style={styles.logoContainer}>
              {/* Empty for alignment */}
            </View>
          </View>

          {/* Invoice Info Table */}
          <View style={styles.section}>
            <View style={styles.table}>
              {/* Row 1 */}
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.bold, { width: "33%" }]}>
                  Invoice No.
                </Text>
                <Text style={[styles.tableCell, styles.bold, { width: "33%" }]}>
                  Invoice Date
                </Text>
                <Text style={[styles.tableCell, styles.bold, { width: "34%" }]}>
                  Due Date
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "33%" }]}>
                  {data.invoice.number}
                </Text>
                <Text style={[styles.tableCell, { width: "33%" }]}>
                  {data.invoice.orderDate}
                </Text>
                <Text style={[styles.tableCell, { width: "34%" }]}>
                  {data.invoice.dueDate}
                </Text>
              </View>

              {/* Row 2 */}
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.bold, { width: "33%" }]}>
                  Reference No. & Date.
                </Text>
                <Text style={[styles.tableCell, styles.bold, { width: "33%" }]}>
                  Buyer's Order No.
                </Text>
                <Text style={[styles.tableCell, styles.bold, { width: "34%" }]}>
                  Dated
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "33%" }]}>
                  {data.invoice.referenceNo}
                </Text>
                <Text style={[styles.tableCell, { width: "33%" }]}>
                  {data.invoice.quotationId || ""}
                </Text>
                <Text style={[styles.tableCell, { width: "34%" }]}>
                  {data.invoice.orderDate}
                </Text>
              </View>

              {/* Row 3 */}
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.bold, { width: "33%" }]}>
                  e-Way Bill No.
                </Text>
                <Text style={[styles.tableCell, styles.bold, { width: "33%" }]}>
                  Payment Status
                </Text>
                <Text style={[styles.tableCell, styles.bold, { width: "34%" }]}>
                  Balance Amount
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "33%" }]}>
                  {data.invoice.eWayBill}
                </Text>
                <Text style={[styles.tableCell, { width: "33%" }]}>
                  {data.paymentInfo.status}
                </Text>
                <Text style={[styles.tableCell, { width: "34%" }]}>
                  ₹{data.paymentInfo.balanceAmount}
                </Text>
              </View>
            </View>
          </View>

          {/* Buyer and Consignee Details */}
          <View style={styles.section}>
            <View style={styles.tableRow}>
              <View style={[styles.tableCell, { width: "50%" }]}>
                <Text style={[styles.sectionTitle, { marginBottom: 2 }]}>
                  Buyer (Bill to)
                </Text>
                <Text style={styles.bold}>{data.buyer.name}</Text>
                <Text>{data.buyer.address}</Text>
                <Text>GSTIN/UIN : {data.buyer.gstin}</Text>
                <Text>State Name : {data.buyer.state}</Text>
                <Text>Place of Supply : {data.buyer.placeOfSupply}</Text>
                <Text>Contact person : {data.buyer.contactPerson}</Text>
                <Text>Contact : {data.buyer.phone}</Text>
                <Text>E-Mail : {data.buyer.email}</Text>
              </View>
              <View style={[styles.tableCell, { width: "50%" }]}>
                <Text style={[styles.sectionTitle, { marginBottom: 2 }]}>
                  Consignee (Ship to)
                </Text>
                <Text style={styles.bold}>{data.consignee.name}</Text>
                <Text>{data.consignee.address}</Text>
                <Text>GSTIN/UIN : {data.consignee.gstin}</Text>
                <Text>State Name : {data.consignee.state}</Text>
                <Text>Contact person : {data.consignee.contactPerson}</Text>
                <Text>Contact : {data.consignee.phone}</Text>
              </View>
            </View>
          </View>

          {/* Additional Info */}
          <View style={styles.section}>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.bold, { width: "50%" }]}>
                  State Code
                </Text>
                <Text style={[styles.tableCell, styles.bold, { width: "50%" }]}>
                  Amount Paid
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "50%" }]}>
                  {data.invoice.stateCode || ""}
                </Text>
                <Text style={[styles.tableCell, { width: "50%" }]}>
                  ₹{data.paymentInfo.amountPaid}
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.bold, { width: "100%" }]}>
                  Notes
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: "100%" }]}>
                  {data.notes}
                </Text>
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
                <Text style={[styles.tableCell, { width: "12%", textAlign: "center" }]}>
                  Quantity
                </Text>
                <Text style={[styles.tableCell, { width: "16%", textAlign: "right" }]}>
                  Rate
                </Text>
                <Text style={[styles.tableCell, { width: "17%", textAlign: "right" }]}>
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
                  <Text style={[styles.tableCell, { width: "12%", textAlign: "center" }]}>
                    {item.quantity}
                  </Text>
                  <Text style={[styles.tableCell, { width: "16%", textAlign: "right" }]}>
                    {formatCurrency(item.rate)}
                  </Text>
                  <Text style={[styles.tableCell, { width: "17%", textAlign: "right" }]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))}

              {/* Tax Rows */}
              {renderTaxRows(data, itemTotals)}

              {/* Total Row */}
              <View style={[styles.tableRow, { fontWeight: "bold" }]}>
                <Text style={[styles.tableCell, { width: "55%" }]}>
                  Total
                </Text>
                <Text style={[styles.tableCell, { width: "12%", textAlign: "center" }]}>
                  {itemTotals.totalQuantity}
                </Text>
                <Text style={[styles.tableCell, { width: "16%", textAlign: "right" }]}>
                  ₹
                </Text>
                <Text style={[styles.tableCell, { width: "17%", textAlign: "right" }]}>
                  {data.total}
                </Text>
              </View>
            </View>
          </View>

          {/* Amount in Words */}
          <View style={[styles.section, { marginBottom: 10 }]}>
            <Text>
              <Text style={styles.bold}>Amount Chargeable (in words)</Text> E. & O.E
            </Text>
            <Text style={styles.bold}>INR {data.amountInWords}</Text>
          </View>

          {/* Tax Summary Table */}
          <View style={styles.section}>
            <View style={styles.table}>
              {/* Table Header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, { width: "15%" }]}>
                  HSN/SAC
                </Text>
                <Text style={[styles.tableCell, { width: "20%", textAlign: "right" }]}>
                  Taxable Value
                </Text>
                {parseFloat(itemTotals.totalIGST) > 0 ? (
                  <>
                    <Text style={[styles.tableCell, { width: "10%", textAlign: "center" }]}>
                      IGST
                    </Text>
                    <Text style={[styles.tableCell, { width: "10%", textAlign: "center" }]}>
                      Rate
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                      Amount
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                      Total Tax Amount
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.tableCell, { width: "8%", textAlign: "center" }]}>
                      CGST
                    </Text>
                    <Text style={[styles.tableCell, { width: "7%", textAlign: "center" }]}>
                      Rate
                    </Text>
                    <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>
                      Amount
                    </Text>
                    <Text style={[styles.tableCell, { width: "8%", textAlign: "center" }]}>
                      SGST/UTGST
                    </Text>
                    <Text style={[styles.tableCell, { width: "7%", textAlign: "center" }]}>
                      Rate
                    </Text>
                    <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>
                      Amount
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
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
                  <Text style={[styles.tableCell, { width: "20%", textAlign: "right" }]}>
                    {formatCurrency(row.taxableValue)}
                  </Text>

                  {parseFloat(itemTotals.totalIGST) > 0 ? (
                    <>
                      <Text style={[styles.tableCell, { width: "10%", textAlign: "center" }]}>
                        IGST
                      </Text>
                      <Text style={[styles.tableCell, { width: "10%", textAlign: "center" }]}>
                        {row.igstPercent}%
                      </Text>
                      <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                        {formatCurrency(row.igst)}
                      </Text>
                      <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                        {formatCurrency(row.igst)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.tableCell, { width: "8%", textAlign: "center" }]}>
                        CGST
                      </Text>
                      <Text style={[styles.tableCell, { width: "7%", textAlign: "center" }]}>
                        {row.cgstPercent}%
                      </Text>
                      <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>
                        {formatCurrency(row.cgst)}
                      </Text>
                      <Text style={[styles.tableCell, { width: "8%", textAlign: "center" }]}>
                        SGST/UTGST
                      </Text>
                      <Text style={[styles.tableCell, { width: "7%", textAlign: "center" }]}>
                        {row.sgstPercent}%
                      </Text>
                      <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>
                        {formatCurrency(row.sgst)}
                      </Text>
                      <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                        {formatCurrency(row.cgst + row.sgst)}
                      </Text>
                    </>
                  )}
                </View>
              ))}

              {/* Total Row */}
              <View style={[styles.tableRow, { fontWeight: "bold" }]}>
                <Text style={[styles.tableCell, { width: "15%" }]}>
                  Total
                </Text>
                <Text style={[styles.tableCell, { width: "20%", textAlign: "right" }]}>
                  {data.subtotal}
                </Text>
                {parseFloat(itemTotals.totalIGST) > 0 ? (
                  <>
                    <Text style={[styles.tableCell, { width: "20%", textAlign: "center" }]} colSpan="2">
                      
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                      {data.igst}
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                      {data.taxAmount}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "center" }]} colSpan="2">
                      
                    </Text>
                    <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>
                      {data.cgst}
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "center" }]} colSpan="2">
                      
                    </Text>
                    <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>
                      {data.sgst}
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%", textAlign: "right" }]}>
                      {data.taxAmount}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Tax Amount in Words */}
          <View style={[styles.section, { marginBottom: 15 }]}>
            <Text style={styles.bold}>
              Tax Amount (in words) : INR {data.taxAmountInWords}
            </Text>
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
            <Text>for {data.company.name}</Text>
            <Text style={[styles.bold, { marginTop: 60 }]}>
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