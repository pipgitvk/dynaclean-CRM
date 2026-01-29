"use client";

import React from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Dummy data - Replace with your SQL database data
const dummyInvoiceData = {
  company: {
    name: "Dynaclean Industries Pvt. Ltd.",
    address:
      "4th Floor, PLOT No-9, Block-B, Pocket-3, Sector-17, Dwarka,, Pincode:110078",
    contact:
      "Tel.7982456944, Mob:9220454360, E-Mail:sales@dynacleanindustries.com",
    gstin: "GSTIN/UIN:07AAKCD6495M1ZV, State Name:Delhi, Code:07",
  },
  buyer: {
    name: "M/S Ashlesh Enterprises",
    address: "Opp.: M.I.T., Manipal-Karkala Road, Manipal",
    gstin: "29AAIFA3943L1Z3",
    state: "Karnataka, Code : 29",
    placeOfSupply: "Karnataka",
    contactPerson: "Ganesh Shanay",
    phone: "9620144079",
    email: "ashleshhotelmanipal@yahoo.com",
  },
  invoice: {
    number: "DYN/2025-26/0347",
    eWayBill: "7115 9881 3229",
    referenceNo: "QUOTE20260120009 dt. 20-Jan-26",
    orderDate: "20-Jan-26",
  },
  items: [
    {
      slNo: 1,
      description: "Auto Scrubber Drier DYNA-40",
      specs:
        "Clear/Waste Water Tank: 40/45 L, Scrubbing Width: 460 mm, Squeegee Width: 780 mm, Cleaning Efficiency: 1800 m3/h, Battery Capacity/Wire Size: 15 m, Voltage: 220 V, Brush/Suction Motor Power 550/550 W, Brush Pressure: 25 Kg, Size: 970 x 540 x 970 mm, Weight: 65 kg, Working Time: N/A",
      hsn: "84798999",
      qty: "1 Nos",
      rate: "88,500.00 Nos",
      amount: "88,500.00",
    },
  ],
  taxRate: 18,
  taxAmount: "15,930.00",
  total: "1,04,430.00",
  terms: [
    "100% Payment Advance With PO",
    "Late payment charges: Interest charges at the rate of 1.5% per month or as per MSME act 2006 whichever is higher will be charged on overdue amounts from the invoice due date",
    "Packing & forwarding and freight inclusive",
    "one year Warranty (Consumable items are not included).",
    "Above Rates Are Valid For One Month Only",
  ],
  bank: {
    name: "ICICI Bank",
    accountNo: "343405500379",
    branch: "Dwarka Sec-17 & ICIC0003434",
  },
};

const NewInvoice = ({ data = dummyInvoiceData }) => {
  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Tax Invoice", 105, 15, { align: "center" });

    doc.setFontSize(9);
    doc.text(data.company.name, 14, 25);
    doc.setFontSize(8);
    doc.text(data.company.address, 14, 30);
    doc.text(data.company.contact, 14, 35);
    doc.text(data.company.gstin, 14, 40);

    doc.save(`Invoice-${data.invoice.number}.pdf`);
  };

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        maxWidth: "210mm",
        margin: "0 auto",
        padding: "10mm",
        backgroundColor: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "10px",
          borderBottom: "2px solid #000",
          paddingBottom: "5px",
        }}
      >
        <h1 style={{ margin: "0", fontSize: "18px", fontWeight: "bold" }}>
          Tax Invoice
        </h1>
      </div>

      {/* Company Details */}
      <div style={{ marginBottom: "10px", fontSize: "10px" }}>
        <div style={{ fontWeight: "bold", fontSize: "11px" }}>
          {data.company.name}
        </div>
        <div>{data.company.address}</div>
        <div>{data.company.contact}</div>
        <div>{data.company.gstin}</div>
      </div>

      {/* Invoice Info Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "10px",
          fontSize: "9px",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                width: "33%",
                fontWeight: "bold",
              }}
            >
              Invoice No.
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                width: "33%",
                fontWeight: "bold",
              }}
            >
              e-Way Bill No.
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                width: "34%",
                fontWeight: "bold",
              }}
            >
              Delivery Note
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px" }}>
              {data.invoice.number}
            </td>
            <td style={{ border: "1px solid #000", padding: "4px" }}>
              {data.invoice.eWayBill}
            </td>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
          </tr>
          <tr>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Reference No. & Date.
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Buyer's Order No.
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Dated
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px" }}>
              {data.invoice.referenceNo}
            </td>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
            <td style={{ border: "1px solid #000", padding: "4px" }}>
              {data.invoice.orderDate}
            </td>
          </tr>
          <tr>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Delivery Note Date
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Other References
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Dated
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
          </tr>
        </tbody>
      </table>

      {/* Buyer and Consignee Details */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "10px",
          fontSize: "9px",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                border: "1px solid #000",
                padding: "6px",
                width: "50%",
                verticalAlign: "top",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                Buyer (Bill to)
              </div>
              <div style={{ fontWeight: "bold" }}>{data.buyer.name}</div>
              <div>{data.buyer.address}</div>
              <div>GSTIN/UIN : {data.buyer.gstin}</div>
              <div>State Name : {data.buyer.state}</div>
              <div>Place of Supply : {data.buyer.placeOfSupply}</div>
              <div>Contact person : {data.buyer.contactPerson}</div>
              <div>Contact : {data.buyer.phone}</div>
              <div>E-Mail : {data.buyer.email}</div>
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "6px",
                width: "50%",
                verticalAlign: "top",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                Consignee (Ship to)
              </div>
              <div style={{ fontWeight: "bold" }}>{data.buyer.name}</div>
              <div>{data.buyer.address}</div>
              <div>GSTIN/UIN : {data.buyer.gstin}</div>
              <div>State Name : {data.buyer.state}</div>
              <div>Contact person : {data.buyer.contactPerson}</div>
              <div>Contact : {data.buyer.phone}</div>
              <div>E-Mail : {data.buyer.email}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Additional Info Row */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "10px",
          fontSize: "9px",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Destination
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Dispatch Doc No.
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
          </tr>
          <tr>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Dispatched through
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Mode/Terms of Payment
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
          </tr>
          <tr>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Terms of Delivery
            </td>
            <td style={{ border: "1px solid #000", padding: "4px" }}></td>
          </tr>
        </tbody>
      </table>

      {/* Items Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "10px",
          fontSize: "9px",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f0f0f0" }}>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "left",
              }}
            >
              Sl No.
            </th>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "left",
              }}
            >
              Description of Goods
            </th>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "left",
              }}
            >
              HSN/SAC
            </th>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "center",
              }}
            >
              Quantity
              <br />
              Shipped Billed
            </th>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              Rate per
            </th>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.slNo}>
              <td style={{ border: "1px solid #000", padding: "4px" }}>
                {item.slNo}
              </td>
              <td style={{ border: "1px solid #000", padding: "4px" }}>
                <div style={{ fontWeight: "bold" }}>{item.description}</div>
                <div style={{ fontSize: "8px", marginTop: "2px" }}>
                  {item.specs}
                </div>
              </td>
              <td style={{ border: "1px solid #000", padding: "4px" }}>
                {item.hsn}
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "center",
                }}
              >
                {item.qty}
                <br />
                {item.qty}
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "right",
                }}
              >
                {item.rate}
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "right",
                }}
              >
                {item.amount}
              </td>
            </tr>
          ))}
          <tr>
            <td
              colSpan="5"
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
                fontWeight: "bold",
              }}
            >
              Output IGST {data.taxRate}%
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              {data.taxAmount}
            </td>
          </tr>
          <tr>
            <td
              colSpan="3"
              style={{
                border: "1px solid #000",
                padding: "4px",
                fontWeight: "bold",
              }}
            >
              Total
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "center",
              }}
            >
              {data.items[0].qty}
              <br />
              {data.items[0].qty}
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
                fontWeight: "bold",
              }}
            >
              ₹
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
                fontWeight: "bold",
              }}
            >
              {data.total}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Amount in Words */}
      <div style={{ marginBottom: "10px", fontSize: "9px" }}>
        <strong>Amount Chargeable (in words)</strong> E. & O.E
        <br />
        <strong>INR One Lakh Four Thousand Four Hundred Thirty Only</strong>
      </div>

      {/* Tax Summary Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "10px",
          fontSize: "9px",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f0f0f0" }}>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "left",
              }}
            >
              HSN/SAC
            </th>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              Taxable Value
            </th>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "center",
              }}
            >
              IGST
              <br />
              Rate Amount
            </th>
            <th
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              Total Tax Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px" }}>
              {data.items[0].hsn}
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              {data.items[0].amount}
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "center",
              }}
            >
              {data.taxRate}% {data.taxAmount}
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              {data.taxAmount}
            </td>
          </tr>
          <tr style={{ fontWeight: "bold" }}>
            <td style={{ border: "1px solid #000", padding: "4px" }}>Total</td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              {data.items[0].amount}
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "center",
              }}
            >
              {data.taxAmount}
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              {data.taxAmount}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tax Amount in Words */}
      <div style={{ marginBottom: "15px", fontSize: "9px" }}>
        <strong>
          Tax Amount (in words) : INR Fifteen Thousand Nine Hundred Thirty Only
        </strong>
      </div>

      {/* Terms & Bank Details */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "15px" }}>
        <div style={{ flex: "1", fontSize: "9px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
            Terms & Condition
          </div>
          {data.terms.map((term, index) => (
            <div key={index} style={{ marginBottom: "3px" }}>
              {index + 1} {term}
            </div>
          ))}
        </div>
        <div style={{ width: "250px", fontSize: "9px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
            Company's Bank Details
          </div>
          <div>Bank Name : {data.bank.name}</div>
          <div>A/c No. : {data.bank.accountNo}</div>
          <div>Branch & IFS Code: {data.bank.branch}</div>
        </div>
      </div>

      {/* Signature */}
      <div style={{ textAlign: "right", marginTop: "40px", fontSize: "9px" }}>
        <div>for {data.company.name}</div>
        <div style={{ marginTop: "60px", fontWeight: "bold" }}>
          Authorised Signatory
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          marginTop: "20px",
          fontSize: "8px",
          fontStyle: "italic",
        }}
      >
        This is a Computer Generated Invoice
      </div>

      {/* Action Buttons */}
      <div
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "10px",
          justifyContent: "center",
        }}
      >
        <button
          onClick={generatePDF}
          style={{
            padding: "10px 20px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Download PDF
        </button>
      </div>
    </div>
  );
};

export default NewInvoice;
