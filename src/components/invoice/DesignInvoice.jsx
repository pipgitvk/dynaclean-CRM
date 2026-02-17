// "use client";

// import React from "react";
// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";
// import Image from "next/image";
// import html2canvas from "html2canvas";
// import DownloadPDFButton from "@/app/admin-dashboard/invoices/DownloadButton";
// import InvoicePDFPreview from "../Preview";
// import { numberToWords } from "@/utils/NumbertoWord";

// const NewInvoice = ({ invoice }) => {
//   // Calculate tax rate from the invoice data
//   const calculateTaxRate = () => {
//     if (invoice.subtotal && invoice.subtotal > 0) {
//       if (invoice.igst && invoice.igst > 0) {
//         return ((invoice.igst / invoice.subtotal) * 100).toFixed(2);
//       } else if (invoice.cgst && invoice.cgst > 0) {
//         return ((invoice.cgst / invoice.subtotal) * 100).toFixed(2);
//       }
//     }
//     return "0.00";
//   };

//   // Create items array from invoice items data
//   const createItemsArray = () => {
//     // If invoice has items array (from database), use it
//     if (invoice.items && Array.isArray(invoice.items)) {
//       return invoice.items.map((item, index) => ({
//         sr_no: index + 1,
//         description: item.item_name,
//         fullDescription: item.description || "",
//         hsn: item.hsn_code || "",
//         quantity: parseFloat(item.quantity) || 1,
//         rate: parseFloat(item.rate) || 0,
//         discount_percent: parseFloat(item.discount_percent) || 0,
//         discount_amount: parseFloat(item.discount_amount) || 0,
//         taxable_value: parseFloat(item.taxable_value) || 0,
//         cgst_percent: parseFloat(item.cgst_percent) || 0,
//         sgst_percent: parseFloat(item.sgst_percent) || 0,
//         igst_percent: parseFloat(item.igst_percent) || 0,
//         cgst_amount: parseFloat(item.cgst_amount) || 0,
//         sgst_amount: parseFloat(item.sgst_amount) || 0,
//         igst_amount: parseFloat(item.igst_amount) || 0,
//         total_amount: parseFloat(item.total_amount) || 0,
//         amount: parseFloat(item.taxable_value) || 0,
//       }));
//     } else {
//       // Fallback to old method if no items array
//       return [
//         {
//           sr_no: 1,
//           description: "Invoice Amount",
//           fullDescription: "",
//           hsn: "",
//           quantity: 1,
//           rate: invoice.subtotal || 0,
//           amount: invoice.subtotal || 0,
//         },
//       ];
//     }
//   };

//   // Convert terms_conditions string to array
//   const parseTerms = () => {
//     if (invoice.terms_conditions) {
//       return invoice.terms_conditions
//         .split("\n")
//         .filter((term) => term.trim() !== "");
//     }
//     return [];
//   };

//   // Calculate item-level totals for display
//   const calculateItemTotals = () => {
//     if (!invoice.items || !Array.isArray(invoice.items)) {
//       return {
//         subtotal: invoice.subtotal || 0,
//         totalTax: invoice.total_tax || 0,
//         grandTotal: invoice.grand_total || 0,
//         totalCGST: invoice.cgst || 0,
//         totalSGST: invoice.sgst || 0,
//         totalIGST: invoice.igst || 0,
//         totalQuantity: 1,
//       };
//     }

//     const totals = {
//       subtotal: 0,
//       totalTax: 0,
//       grandTotal: 0,
//       totalCGST: 0,
//       totalSGST: 0,
//       totalIGST: 0,
//       totalQuantity: 0,
//     };

//     invoice.items.forEach((item) => {
//       totals.subtotal += parseFloat(item.taxable_value) || 0;
//       totals.totalCGST += parseFloat(item.cgst_amount) || 0;
//       totals.totalSGST += parseFloat(item.sgst_amount) || 0;
//       totals.totalIGST += parseFloat(item.igst_amount) || 0;
//       totals.totalTax +=
//         (parseFloat(item.cgst_amount) || 0) +
//         (parseFloat(item.sgst_amount) || 0) +
//         (parseFloat(item.igst_amount) || 0);
//       totals.grandTotal += parseFloat(item.total_amount) || 0;
//       totals.totalQuantity += parseFloat(item.quantity) || 0;
//     });

//     return totals;
//   };

//   const itemTotals = calculateItemTotals();
//   const itemsArray = createItemsArray();

//   const data = {
//     company: {
//       name: "Dynaclean Industries Pvt Ltd",
//       address:
//         "1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road, Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu - 641006",
//       phone: "011-45143666, +91-7982456944",
//       email: "sales@dynacleanindustries.com",
//       gstin: "07AAKCD6495M1ZV",
//     },
//     buyer: {
//       name: invoice.customer_name || "",
//       address: invoice.billing_address || "",
//       gstin: invoice.gst_number || "",
//       state: invoice.state || "",
//       placeOfSupply: invoice.state || "",
//       contactPerson: invoice.customer_name || "",
//       phone: invoice.customer_phone || "",
//       email: invoice.customer_email || "",
//     },
//     consignee: {
//       name: invoice.Consignee || invoice.customer_name || "",
//       address: invoice.shipping_address || invoice.billing_address || "",
//       gstin: invoice.gst_number || "",
//       state: invoice.state || "",
//       contactPerson: invoice.customer_name || "",
//       phone: invoice.Consignee_Contact || "",
//     },
//     invoice: {
//       number: invoice.invoice_number || "",
//       eWayBill: "", // Not in your table
//       referenceNo: "", // Not in your table
//       orderDate: invoice.invoice_date
//         ? new Date(invoice.invoice_date)
//             .toLocaleDateString("en-GB", {
//               day: "2-digit",
//               month: "short",
//               year: "2-digit",
//             })
//             .replace(/ /g, "-")
//         : "",
//       dueDate: invoice.due_date
//         ? new Date(invoice.due_date)
//             .toLocaleDateString("en-GB", {
//               day: "2-digit",
//               month: "short",
//               year: "2-digit",
//             })
//             .replace(/ /g, "-")
//         : "",
//     },
//     items: itemsArray,
//     taxRate: calculateTaxRate(),
//     taxAmount: itemTotals.totalTax
//       ? parseFloat(itemTotals.totalTax).toLocaleString("en-IN", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         })
//       : "0.00",
//     total: itemTotals.grandTotal
//       ? parseFloat(itemTotals.grandTotal).toLocaleString("en-IN", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         })
//       : "0.00",
//     subtotal: itemTotals.subtotal
//       ? parseFloat(itemTotals.subtotal).toLocaleString("en-IN", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         })
//       : "0.00",
//     cgst: itemTotals.totalCGST
//       ? parseFloat(itemTotals.totalCGST).toLocaleString("en-IN", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         })
//       : "0.00",
//     sgst: itemTotals.totalSGST
//       ? parseFloat(itemTotals.totalSGST).toLocaleString("en-IN", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         })
//       : "0.00",
//     igst: itemTotals.totalIGST
//       ? parseFloat(itemTotals.totalIGST).toLocaleString("en-IN", {
//           minimumFractionDigits: 2,
//           maximumFractionDigits: 2,
//         })
//       : "0.00",
//     amountInWords: "Not Available", // You'll need to implement number to words conversion
//     taxAmountInWords: "Not Available", // You'll need to implement number to words conversion
//     terms: parseTerms(),
//     notes: invoice.notes || "",
//     bank: {
//       accountHolderName: "Dynaclean Industries Private Limited",
//       name: "ICICI Bank",
//       accountNo: "343405500379",
//       IFSC: "ICIC0003434",
//     },
//     paymentInfo: {
//       status: invoice.payment_status || "UNPAID",
//       amountPaid: invoice.amount_paid
//         ? parseFloat(invoice.amount_paid).toLocaleString("en-IN", {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           })
//         : "0.00",
//       balanceAmount: invoice.balance_amount
//         ? parseFloat(invoice.balance_amount).toLocaleString("en-IN", {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           })
//         : "0.00",
//     },
//   };

//   const containerRef = React.useRef(null);

//   const generatePDF = async () => {
//     const el = containerRef.current;
//     if (!el) return;

//     const loadingDiv = document.createElement("div");
//     loadingDiv.innerHTML = "Generating PDF...";
//     loadingDiv.style.cssText =
//       "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:8px;z-index:9999;font-family:Arial,sans-serif;";
//     document.body.appendChild(loadingDiv);

//     let styleTag;

//     try {
//       const originalWidth = el.style.width;
//       const originalMaxWidth = el.style.maxWidth;
//       const originalPadding = el.style.padding;
//       const originalBorder = el.style.border;

//       el.style.width = "794px";
//       el.style.maxWidth = "794px";
//       el.style.padding = "30px";
//       el.style.border = "none";

//       // Convert images to base64
//       const images = el.querySelectorAll("img");
//       await Promise.all(
//         Array.from(images).map(async (img) => {
//           if (!img.src || img.src.startsWith("data:")) return;
//           try {
//             const src = img.currentSrc || img.src;
//             const res = await fetch(src, {
//               mode: "cors",
//               cache: "force-cache",
//             });
//             const blob = await res.blob();
//             const base64 = await new Promise((resolve, reject) => {
//               const reader = new FileReader();
//               reader.onloadend = () => resolve(reader.result);
//               reader.onerror = reject;
//               reader.readAsDataURL(blob);
//             });
//             img.src = base64;
//             img.removeAttribute("srcset");
//           } catch (err) {
//             console.warn("Image conversion failed:", img.src, err);
//           }
//         }),
//       );

//       await new Promise((r) => setTimeout(r, 200));

//       // CRITICAL FIX: Override ALL color functions
//       styleTag = document.createElement("style");
//       styleTag.setAttribute("data-pdf-override", "true");
//       styleTag.innerHTML = `
//       * {
//         color: rgb(0, 0, 0) !important;
//         background-color: rgb(255, 255, 255) !important;
//         border-color: rgb(0, 0, 0) !important;
//         outline-color: rgb(0, 0, 0) !important;
//         box-shadow: none !important;
//         text-shadow: none !important;
//       }

//       *::before,
//       *::after {
//         color: rgb(0, 0, 0) !important;
//         background-color: rgb(255, 255, 255) !important;
//         border-color: rgb(0, 0, 0) !important;
//       }

//       table {
//         border-collapse: collapse !important;
//       }

//       td, th {
//         page-break-inside: avoid !important;
//       }
//     `;
//       document.head.appendChild(styleTag);

//       await new Promise((r) => setTimeout(r, 100));

//       const canvas = await html2canvas(el, {
//         scale: 2,
//         useCORS: true,
//         allowTaint: false,
//         foreignObjectRendering: false,
//         backgroundColor: "#ffffff",
//         windowWidth: el.scrollWidth,
//         windowHeight: el.scrollHeight,
//         logging: false,
//         imageTimeout: 15000,
//         onclone: (clonedDoc) => {
//           const clonedEl =
//             clonedDoc.body.querySelector("[ref]") ||
//             clonedDoc.body.firstElementChild;
//           if (clonedEl) {
//             clonedEl.style.width = "794px";
//             clonedEl.style.maxWidth = "794px";

//             // Force RGB colors in cloned document
//             const allElements = clonedEl.querySelectorAll("*");
//             allElements.forEach((elem) => {
//               elem.style.color = "rgb(0, 0, 0)";
//               elem.style.backgroundColor = "rgb(255, 255, 255)";
//               elem.style.borderColor = "rgb(0, 0, 0)";
//             });
//           }
//         },
//       });

//       const imgData = canvas.toDataURL("image/png", 1.0);

//       const pdf = new jsPDF({
//         orientation: "portrait",
//         unit: "mm",
//         format: "a4",
//         compress: true,
//       });

//       const pdfWidth = pdf.internal.pageSize.getWidth();
//       const pdfHeight = pdf.internal.pageSize.getHeight();
//       const imgProps = pdf.getImageProperties(imgData);
//       const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

//       let heightLeft = imgHeight;
//       let position = 0;

//       pdf.addImage(
//         imgData,
//         "PNG",
//         0,
//         position,
//         pdfWidth,
//         imgHeight,
//         undefined,
//         "FAST",
//       );
//       heightLeft -= pdfHeight;

//       while (heightLeft > 0) {
//         position -= pdfHeight;
//         pdf.addPage();
//         pdf.addImage(
//           imgData,
//           "PNG",
//           0,
//           position,
//           pdfWidth,
//           imgHeight,
//           undefined,
//           "FAST",
//         );
//         heightLeft -= pdfHeight;
//       }

//       pdf.save(`Invoice-${data.invoice.number.replace(/[/\\]/g, "_")}.pdf`);

//       el.style.width = originalWidth;
//       el.style.maxWidth = originalMaxWidth;
//       el.style.padding = originalPadding;
//       el.style.border = originalBorder;
//     } catch (err) {
//       console.error("PDF generation failed:", err);
//       alert("Failed to generate PDF. Check console for details.");
//     } finally {
//       if (styleTag && styleTag.parentNode) {
//         document.head.removeChild(styleTag);
//       }
//       if (loadingDiv && loadingDiv.parentNode) {
//         document.body.removeChild(loadingDiv);
//       }
//     }
//   };

//   // Calculate totals for display
//   const calculateSubtotal = () => {
//     return data.items.reduce(
//       (sum, item) => sum + parseFloat(item.amount || 0),
//       0,
//     );
//   };

//   const formatCurrency = (value) => {
//     if (!value) return "0.00";
//     return parseFloat(value).toLocaleString("en-IN", {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     });
//   };

//   // to add in single hsn calc
//   const buildHSNSummary = () => {
//     const map = {};

//     data.items.forEach((item) => {
//       const hsn = item.hsn || "NA";

//       if (!map[hsn]) {
//         map[hsn] = {
//           hsn,
//           taxableValue: 0,
//           cgst: 0,
//           sgst: 0,
//           igst: 0,
//           cgstPercent: item.cgst_percent,
//           sgstPercent: item.sgst_percent,
//           igstPercent: item.igst_percent,
//         };
//       }

//       map[hsn].taxableValue += parseFloat(item.amount || 0);
//       map[hsn].cgst += parseFloat(item.cgst_amount || 0);
//       map[hsn].sgst += parseFloat(item.sgst_amount || 0);
//       map[hsn].igst += parseFloat(item.igst_amount || 0);
//     });

//     return Object.values(map);
//   };

//   const hsnSummary = buildHSNSummary();

//   // Function to render tax rows based on available tax data
//   const renderTaxRows = () => {
//     const rows = [];

//     if (parseFloat(itemTotals.totalIGST) > 0) {
//       rows.push(
//         <tr key="igst">
//           <td
//             colSpan="5"
//             style={{
//               border: "1px solid #000",
//               padding: "4px",
//               textAlign: "right",
//               fontWeight: "bold",
//             }}
//           >
//             Output IGST {data.taxRate}%
//           </td>
//           <td
//             style={{
//               border: "1px solid #000",
//               padding: "4px",
//               textAlign: "right",
//             }}
//           >
//             {data.igst}
//           </td>
//         </tr>,
//       );
//     } else {
//       if (parseFloat(itemTotals.totalCGST) > 0) {
//         rows.push(
//           <tr key="cgst">
//             <td
//               colSpan="5"
//               style={{
//                 border: "1px solid #000",
//                 padding: "4px",
//                 textAlign: "right",
//                 fontWeight: "bold",
//               }}
//             >
//               Output CGST {data.taxRate}%
//             </td>
//             <td
//               style={{
//                 border: "1px solid #000",
//                 padding: "4px",
//                 textAlign: "right",
//               }}
//             >
//               {data.cgst}
//             </td>
//           </tr>,
//         );
//       }

//       if (parseFloat(itemTotals.totalSGST) > 0) {
//         rows.push(
//           <tr key="sgst">
//             <td
//               colSpan="5"
//               style={{
//                 border: "1px solid #000",
//                 padding: "4px",
//                 textAlign: "right",
//                 fontWeight: "bold",
//               }}
//             >
//               Output SGST {data.taxRate}%
//             </td>
//             <td
//               style={{
//                 border: "1px solid #000",
//                 padding: "4px",
//                 textAlign: "right",
//               }}
//             >
//               {data.sgst}
//             </td>
//           </tr>,
//         );
//       }
//     }

//     return rows;
//   };

//   return (
//     <>
//       <div
//         style={{
//           display: "flex",
//           gap: "10px",
//           padding: "10px",
//           justifyContent: "flex-end",
//         }}
//       >
//         <button
//           onClick={generatePDF}
//           style={{
//             padding: "10px 20px",
//             backgroundColor: "#2196F3",
//             color: "white",
//             border: "none",
//             borderRadius: "4px",
//             cursor: "pointer",
//           }}
//         >
//           Download PDF
//         </button>
//         <DownloadPDFButton invoiceData={data} />
//       </div>
//       <div
//         ref={containerRef}
//         style={{
//           fontFamily: "Arial, sans-serif",
//           fontSize: "11px",
//           maxWidth: "210mm",
//           margin: "0 auto",
//           padding: "10mm",
//           background: "#fff",
//           backgroundColor: "#fff",
//           border: "1px solid #000",
//         }}
//       >
//         {/* Header */}
//         <div
//           style={{
//             textAlign: "center",
//             marginBottom: "5px",
//             paddingBottom: "5px",
//           }}
//         >
//           <h1 style={{ margin: "0", fontSize: "15px", fontWeight: "semibold" }}>
//             Tax Invoice
//           </h1>
//         </div>
//         {/* Company Details */}
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//             tableLayout: "fixed",
//             border: "1px solid #000",
//             borderBottom: "0px",
//           }}
//         >
//           <tbody>
//             <tr style={{ height: "110px" }}>
//               {/* Left - Logo */}
//               <td style={{ width: "25%" }}>
//                 <img
//                   src="/logo.png"
//                   style={{ width: 110, height: "auto", display: "block" }}
//                   alt="logo"
//                 />
//               </td>

//               {/* Center - Company Details */}
//               <td style={{ width: "75%" }}>
//                 <div
//                   style={{
//                     display: "flex",
//                     flexDirection: "column",
//                     justifyContent: "center",
//                     alignItems: "center",
//                     height: "110px",
//                     textAlign: "center",
//                   }}
//                 >
//                   <div
//                     style={{
//                       fontWeight: "bold",
//                       fontSize: "20px",
//                       marginBottom: "4px",
//                       marginTop: "4px",
//                     }}
//                   >
//                     {data.company.name}
//                   </div>

//                   <div style={{ fontSize: "10px", marginBottom: "4px" }}>
//                     {data.company.address}
//                   </div>

//                   <div style={{ fontSize: "10px", marginBottom: "3px" }}>
//                     Ph: {data.company.phone}
//                   </div>

//                   <div style={{ fontSize: "10px", marginBottom: "6px" }}>
//                     GST: {data.company.gstin}
//                   </div>
//                 </div>
//               </td>

//               {/* Right Empty */}
//               <td style={{ width: "25%" }}></td>
//             </tr>
//           </tbody>
//         </table>

//         {/* Invoice Info Table */}
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//             fontSize: "9px",
//           }}
//         >
//           <tbody>
//             <tr>
//               <td
//                 style={{
//                   border: "0.2px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   width: "33%",
//                   fontWeight: "bold",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 Invoice No.
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   width: "33%",
//                   fontWeight: "bold",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                   marginBottom: "20px",
//                 }}
//               >
//                 Invoice Date
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   width: "34%",
//                   fontWeight: "bold",
//                   borderBottom: "0px",
//                 }}
//               >
//                 Due Date
//               </td>
//             </tr>
//             <tr>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 {data.invoice.number}
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 {data.invoice.orderDate}
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                 }}
//               >
//                 {data.invoice.dueDate}
//               </td>
//             </tr>
//             <tr>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 <b>Reference No. & Date.</b>
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 <b>Buyer's Order No.</b>
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                 }}
//               >
//                 <b>Dated</b>
//               </td>
//             </tr>
//             <tr>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 {data.invoice.referenceNo}
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 {invoice.quotation_id ? `QT-${invoice.quotation_id}` : ""}
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                 }}
//               >
//                 {data.invoice.orderDate}
//               </td>
//             </tr>
//             <tr>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 <b>e-Way Bill No.</b>
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 <b>Payment Status</b>
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                 }}
//               >
//                 <b>Balance Amount</b>
//               </td>
//             </tr>
//             <tr>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 {data.invoice.eWayBill}
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 {data.paymentInfo.status}
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   paddingBottom: "10px",
//                   borderBottom: "0px",
//                 }}
//               >
//                 ₹{data.paymentInfo.balanceAmount}
//               </td>
//             </tr>
//           </tbody>
//         </table>

//         {/* Buyer and Consignee Details */}
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//             marginBottom: "10px",
//             fontSize: "9px",
//           }}
//         >
//           <tbody>
//             <tr>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "6px",
//                   width: "50%",
//                   verticalAlign: "top",
//                   borderRight: "0px",
//                 }}
//               >
//                 <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
//                   Buyer (Bill to)
//                 </div>
//                 <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
//                   {data.buyer.name}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   {data.buyer.address}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   GSTIN/UIN : {data.buyer.gstin}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   State Name : {data.buyer.state}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   Place of Supply : {data.buyer.placeOfSupply}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   Contact person : {data.buyer.contactPerson}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   Contact : {data.buyer.phone}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   E-Mail : {data.buyer.email}
//                 </div>
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "6px",
//                   width: "50%",
//                   verticalAlign: "top",
//                 }}
//               >
//                 <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
//                   Consignee (Ship to)
//                 </div>
//                 <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
//                   {data.consignee.name}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   {data.consignee.address}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   GSTIN/UIN : {data.consignee.gstin}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   State Name : {data.consignee.state}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   Contact person : {data.consignee.contactPerson}
//                 </div>
//                 <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//                   Contact : {data.consignee.phone}
//                 </div>
//               </td>
//             </tr>
//           </tbody>
//         </table>

//         {/* Additional Info Row */}
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//             fontSize: "9px",
//           }}
//         >
//           <tbody>
//             <tr>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   fontWeight: "bold",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 State Code
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   fontWeight: "bold",
//                   borderBottom: "0px",
//                 }}
//               >
//                 Amount Paid
//               </td>
//             </tr>
//             <tr>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 {invoice.state_code || ""}
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   borderBottom: "0px",
//                 }}
//               >
//                 ₹{data.paymentInfo.amountPaid}
//               </td>
//             </tr>
//             <tr>
//               <td
//                 colSpan="2"
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   fontWeight: "bold",
//                   borderBottom: "0px",
//                 }}
//               >
//                 Notes
//               </td>
//             </tr>
//             <tr>
//               <td
//                 colSpan="2"
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   borderBottom: "0px",
//                 }}
//               >
//                 {data.notes}
//               </td>
//             </tr>
//           </tbody>
//         </table>

//         {/* Items Table */}
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//             marginBottom: "10px",
//             fontSize: "9px",
//           }}
//         >
//           <thead>
//             <tr style={{ backgroundColor: "#f0f0f0" }}>
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "left",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 Sl No.
//               </th>
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "left",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 Description of Goods
//               </th>
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "left",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 HSN/SAC
//               </th>
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "center",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 Quantity
//               </th>
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "right",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 Rate
//               </th>
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "right",
//                   borderBottom: "0px",
//                 }}
//               >
//                 Amount
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {data.items.map((item) => (
//               <tr key={item.sr_no}>
//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     borderBottom: "0px",
//                     borderRight: "0px",
//                   }}
//                 >
//                   {item.sr_no}
//                 </td>
//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     borderBottom: "0px",
//                     borderRight: "0px",
//                   }}
//                 >
//                   <div style={{ fontWeight: "bold" }}>{item.description}</div>
//                   {item.fullDescription && (
//                     <div
//                       style={{
//                         fontSize: "8px",
//                         marginTop: "2px",
//                         lineHeight: "1.2",
//                       }}
//                     >
//                       {item.fullDescription}
//                     </div>
//                   )}
//                 </td>
//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     borderBottom: "0px",
//                     borderRight: "0px",
//                   }}
//                 >
//                   {item.hsn}
//                 </td>
//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     textAlign: "center",
//                     borderBottom: "0px",
//                     borderRight: "0px",
//                   }}
//                 >
//                   {item.quantity}
//                 </td>
//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     textAlign: "right",
//                     borderBottom: "0px",
//                     borderRight: "0px",
//                   }}
//                 >
//                   {formatCurrency(item.rate)}
//                 </td>
//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     textAlign: "right",
//                     borderBottom: "0px",
//                   }}
//                 >
//                   {formatCurrency(item.amount)}
//                 </td>
//               </tr>
//             ))}

//             {/* Tax Rows */}
//             {renderTaxRows()}

//             <tr>
//               <td
//                 colSpan="3"
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   fontWeight: "bold",
//                   borderRight: "0px",
//                 }}
//               >
//                 Total
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "center",
//                   fontWeight: "bold",
//                   borderRight: "0px",
//                 }}
//               >
//                 {itemTotals.totalQuantity}
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "right",
//                   fontWeight: "bold",
//                   borderRight: "0px",
//                 }}
//               >
//                 ₹
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "right",
//                   fontWeight: "bold",
//                 }}
//               >
//                 {data.total}
//               </td>
//             </tr>
//           </tbody>
//         </table>

//         {/* Amount in Words */}
//         <div style={{ marginBottom: "8px", fontSize: "9px" }}>
//           <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
//             Amount Chargeable (in words) E. & O.E
//           </div>
//           <br />
//           <strong>INR- {numberToWords(data.total)}</strong>
//         </div>

//         {/* Tax Summary Table */}
//         <table
//           style={{
//             width: "100%",
//             borderCollapse: "collapse",
//             marginBottom: "10px",
//             fontSize: "9px",
//           }}
//         >
//           <thead>
//             <tr style={{ backgroundColor: "#f0f0f0" }}>
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "left",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 HSN/SAC
//               </th>
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "right",
//                   borderBottom: "0px",
//                   borderRight: "0px",
//                 }}
//               >
//                 Taxable Value
//               </th>
//               {parseFloat(itemTotals.totalIGST) > 0 ? (
//                 <>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     IGST
//                   </th>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     Rate
//                   </th>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "right",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     Amount
//                   </th>
//                 </>
//               ) : (
//                 <>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     CGST
//                   </th>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     Rate
//                   </th>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "right",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     Amount
//                   </th>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     SGST/UTGST
//                   </th>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     Rate
//                   </th>
//                   <th
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "right",
//                       borderBottom: "0px",
//                       borderRight: "0px",
//                     }}
//                   >
//                     Amount
//                   </th>
//                 </>
//               )}
//               <th
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "right",
//                   borderBottom: "0px",
//                 }}
//               >
//                 Total Tax Amount
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {hsnSummary.map((row, idx) => (
//               <tr key={idx}>
//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     borderBottom: "0px",
//                     borderRight: "0px",
//                   }}
//                 >
//                   {row.hsn}
//                 </td>

//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     textAlign: "right",
//                     borderBottom: "0px",
//                     borderRight: "0px",
//                   }}
//                 >
//                   {formatCurrency(row.taxableValue)}
//                 </td>

//                 {parseFloat(itemTotals.totalIGST) > 0 ? (
//                   <>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "center",
//                       }}
//                     >
//                       IGST
//                     </td>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "center",
//                       }}
//                     >
//                       {row.igstPercent}%
//                     </td>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "right",
//                       }}
//                     >
//                       {formatCurrency(row.igst)}
//                     </td>
//                   </>
//                 ) : (
//                   <>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "center",
//                         borderBottom: "0px",
//                         borderRight: "0px",
//                       }}
//                     >
//                       CGST
//                     </td>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "center",
//                         borderBottom: "0px",
//                         borderRight: "0px",
//                       }}
//                     >
//                       {row.cgstPercent}%
//                     </td>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "right",
//                         borderBottom: "0px",
//                         borderRight: "0px",
//                       }}
//                     >
//                       {formatCurrency(row.cgst)}
//                     </td>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "center",
//                         borderBottom: "0px",
//                         borderRight: "0px",
//                       }}
//                     >
//                       SGST/UTGST
//                     </td>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "center",
//                         borderBottom: "0px",
//                         borderRight: "0px",
//                       }}
//                     >
//                       {row.sgstPercent}%
//                     </td>
//                     <td
//                       style={{
//                         border: "1px solid #000",
//                         padding: "4px",
//                         textAlign: "right",
//                         borderBottom: "0px",
//                         borderRight: "0px",
//                       }}
//                     >
//                       {formatCurrency(row.sgst)}
//                     </td>
//                   </>
//                 )}

//                 <td
//                   style={{
//                     border: "1px solid #000",
//                     padding: "4px",
//                     textAlign: "right",
//                     borderBottom: "0px",
//                   }}
//                 >
//                   {parseFloat(itemTotals.totalIGST) > 0
//                     ? formatCurrency(row.igst)
//                     : formatCurrency(row.cgst + row.sgst)}
//                 </td>
//               </tr>
//             ))}

//             {/* TOTAL ROW */}
//             <tr style={{ fontWeight: "bold" }}>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   borderRight: "0px",
//                 }}
//               >
//                 Total
//               </td>
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "right",
//                   borderRight: "0px",
//                 }}
//               >
//                 {data.subtotal}
//               </td>
//               {parseFloat(itemTotals.totalIGST) > 0 ? (
//                 <>
//                   <td
//                     colSpan="2"
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderRight: "0px",
//                     }}
//                   ></td>
//                   <td
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "right",
//                       borderRight: "0px",
//                     }}
//                   >
//                     {data.igst}
//                   </td>
//                 </>
//               ) : (
//                 <>
//                   <td
//                     colSpan="2"
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderRight: "0px",
//                     }}
//                   ></td>
//                   <td
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "right",
//                       borderRight: "0px",
//                     }}
//                   >
//                     {data.cgst}
//                   </td>
//                   <td
//                     colSpan="2"
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "center",
//                       borderRight: "0px",
//                     }}
//                   ></td>
//                   <td
//                     style={{
//                       border: "1px solid #000",
//                       padding: "4px",
//                       textAlign: "right",
//                       borderRight: "0px",
//                     }}
//                   >
//                     {data.sgst}
//                   </td>
//                 </>
//               )}
//               <td
//                 style={{
//                   border: "1px solid #000",
//                   padding: "4px",
//                   textAlign: "right",
//                 }}
//               >
//                 {data.taxAmount}
//               </td>
//             </tr>
//           </tbody>
//         </table>

//         {/* Tax Amount in Words */}
//         <div style={{ marginBottom: "15px", fontSize: "9px" }}>
//           <strong>
//             Tax Amount (in words) : INR- {numberToWords(data.taxAmount)}
//           </strong>
//         </div>

//         {/* Terms & Bank Details */}
//         <div style={{ display: "flex", gap: "20px", marginBottom: "15px" }}>
//           <div style={{ flex: "1", fontSize: "9px" }}>
//             <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
//               Terms & Condition
//             </div>
//             {data.terms.length > 0 ? (
//               data.terms.map((term, index) => (
//                 <div key={index} style={{ marginBottom: "3px" }}>
//                   {term}
//                 </div>
//               ))
//             ) : (
//               <div>No terms and conditions specified.</div>
//             )}
//           </div>
//           <div style={{ width: "250px", fontSize: "9px" }}>
//             <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
//               Company's Bank Details
//             </div>
//             <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//               A/C Holder Name : {data.bank.accountHolderName}
//             </div>
//             <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//               Bank Name : {data.bank.name}
//             </div>
//             <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//               A/c No. : {data.bank.accountNo}
//             </div>
//             <div style={{ fontSize: "10px", marginBottom: "2px" }}>
//               Branch & IFS Code: {data.bank.IFSC}
//             </div>
//           </div>
//         </div>

//         {/* Signature */}
//         <div style={{ textAlign: "right", marginTop: "40px", fontSize: "9px" }}>
//           <div>for {data.company.name}</div>
//           <div style={{ marginTop: "60px", fontWeight: "bold" }}>
//             Authorised Signatory
//           </div>
//         </div>

//         {/* Footer */}
//         <div
//           style={{
//             textAlign: "center",
//             marginTop: "20px",
//             fontSize: "8px",
//             fontStyle: "italic",
//           }}
//         >
//           This is a Computer Generated Invoice
//         </div>
//       </div>
//       <div style={{ width: "80%", marginTop: "20px" }}>
//         <InvoicePDFPreview invoiceData={data} />
//       </div>
//     </>
//   );
// };

// export default NewInvoice;
"use client";

import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Image from "next/image";
import signImg from "../../../public/s.png"
import html2canvas from "html2canvas";
import DownloadPDFButton from "@/app/admin-dashboard/invoices/DownloadButton";
import InvoicePDFPreview from "../Preview";
import { numberToWords } from "@/utils/NumbertoWord";
console.log(signImg);


const NewInvoice = ({ invoice }) => {
  // Calculate tax rate from the invoice data
  const calculateTaxRate = () => {
    if (invoice.subtotal && invoice.subtotal > 0) {
      if (invoice.igst && invoice.igst > 0) {
        return ((invoice.igst / invoice.subtotal) * 100).toFixed(2);
      } else if (invoice.cgst && invoice.cgst > 0) {
        return ((invoice.cgst / invoice.subtotal) * 100).toFixed(2);
      }
    }
    return "0.00";
  };

  // Create items array from invoice items data
  const createItemsArray = () => {
    // If invoice has items array (from database), use it
    if (invoice.items && Array.isArray(invoice.items)) {
      return invoice.items.map((item, index) => ({
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
    } else {
      // Fallback to old method if no items array
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
    }
  };

  // Convert terms_conditions string to array
  const parseTerms = () => {
    if (invoice.terms_conditions) {
      return invoice.terms_conditions
        .split("\n")
        .filter((term) => term.trim() !== "");
    }
    return [];
  };

  // Calculate item-level totals for display
  const calculateItemTotals = () => {
    if (!invoice.items || !Array.isArray(invoice.items)) {
      return {
        subtotal: invoice.subtotal || 0,
        totalTax: invoice.total_tax || 0,
        grandTotal: invoice.grand_total || 0,
        totalCGST: invoice.cgst || 0,
        totalSGST: invoice.sgst || 0,
        totalIGST: invoice.igst || 0,
        totalQuantity: 1,
      };
    }

    const totals = {
      subtotal: 0,
      totalTax: 0,
      grandTotal: 0,
      totalCGST: 0,
      totalSGST: 0,
      totalIGST: 0,
      totalQuantity: 0,
    };

    invoice.items.forEach((item) => {
      totals.subtotal += parseFloat(item.taxable_value) || 0;
      totals.totalCGST += parseFloat(item.cgst_amount) || 0;
      totals.totalSGST += parseFloat(item.sgst_amount) || 0;
      totals.totalIGST += parseFloat(item.igst_amount) || 0;
      totals.totalTax +=
        (parseFloat(item.cgst_amount) || 0) +
        (parseFloat(item.sgst_amount) || 0) +
        (parseFloat(item.igst_amount) || 0);
      totals.grandTotal += parseFloat(item.total_amount) || 0;
      totals.totalQuantity += parseFloat(item.quantity) || 0;
    });

    return totals;
  };

  const itemTotals = calculateItemTotals();
  const itemsArray = createItemsArray();

  const data = {
    company: {
      name: "Dynaclean Industries Pvt Ltd",
      address:
        "1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road, Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu - 641006",
      phone: "011-45143666, +91-7982456944",
      email: "sales@dynacleanindustries.com",
      gstin: "07AAKCD6495M1ZV",
    },
    buyer: {
      name: invoice.customer_name || "",
      address: invoice.billing_address || "",
      gstin: invoice.gst_number || "",
      state: invoice.state || "",
      placeOfSupply: invoice.state || "",
      contactPerson: invoice.customer_name || "",
      phone: invoice.customer_phone || "",
      email: invoice.customer_email || "",
    },
    consignee: {
      name: invoice.Consignee || invoice.customer_name || "",
      address: invoice.shipping_address || invoice.billing_address || "",
      gstin: invoice.gst_number || "",
      state: invoice.state || "",
      contactPerson: invoice.customer_name || "",
      phone: invoice.Consignee_Contact || "",
    },
    invoice: {
      number: invoice.invoice_number || "",
      eWayBill: "", // Not in your table
      referenceNo: "123456", // Not in your table
      orderDate: invoice.invoice_date
        ? new Date(invoice.invoice_date)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
            .replace(/ /g, "-")
        : "",
      dueDate: invoice.due_date
        ? new Date(invoice.due_date)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
            .replace(/ /g, "-")
        : "",
    },
    items: itemsArray,
    taxRate: calculateTaxRate(),
    taxAmount: itemTotals.totalTax
      ? parseFloat(itemTotals.totalTax).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00",
    total: itemTotals.grandTotal
      ? parseFloat(itemTotals.grandTotal).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00",
    subtotal: itemTotals.subtotal
      ? parseFloat(itemTotals.subtotal).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00",
    cgst: itemTotals.totalCGST
      ? parseFloat(itemTotals.totalCGST).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00",
    sgst: itemTotals.totalSGST
      ? parseFloat(itemTotals.totalSGST).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00",
    igst: itemTotals.totalIGST
      ? parseFloat(itemTotals.totalIGST).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00",
    amountInWords: "Not Available", // You'll need to implement number to words conversion
    taxAmountInWords: "Not Available", // You'll need to implement number to words conversion
    terms: parseTerms(),
    notes: invoice.notes || "",
    bank: {
      accountHolderName: "Dynaclean Industries Private Limited",
      name: "ICICI Bank",
      accountNo: "343405500379",
      IFSC: "ICIC0003434",
    },
    paymentInfo: {
      status: invoice.payment_status || "UNPAID",
      amountPaid: invoice.amount_paid
        ? parseFloat(invoice.amount_paid).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "0.00",
      balanceAmount: invoice.balance_amount
        ? parseFloat(invoice.balance_amount).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "0.00",
    },
  };

  const containerRef = React.useRef(null);

  const generatePDF = async () => {
    const el = containerRef.current;
    if (!el) return;

    const loadingDiv = document.createElement("div");
    loadingDiv.innerHTML = "Generating PDF...";
    loadingDiv.style.cssText =
      "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:8px;z-index:9999;font-family:Arial,sans-serif;";
    document.body.appendChild(loadingDiv);

    let styleTag;

    try {
      const originalWidth = el.style.width;
      const originalMaxWidth = el.style.maxWidth;
      const originalPadding = el.style.padding;
      const originalBorder = el.style.border;

      el.style.width = "794px";
      el.style.maxWidth = "794px";
      el.style.padding = "25px";
      el.style.border = "none";

      // Convert images to base64
      const images = el.querySelectorAll("img");
      await Promise.all(
        Array.from(images).map(async (img) => {
          if (!img.src || img.src.startsWith("data:")) return;
          try {
            const src = img.currentSrc || img.src;
            const res = await fetch(src, {
              mode: "cors",
              cache: "force-cache",
            });
            const blob = await res.blob();
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            img.src = base64;
            img.removeAttribute("srcset");
          } catch (err) {
            console.warn("Image conversion failed:", img.src, err);
          }
        }),
      );

      await new Promise((r) => setTimeout(r, 200));

      // CRITICAL FIX: Override ALL color functions
      styleTag = document.createElement("style");
      styleTag.setAttribute("data-pdf-override", "true");
      styleTag.innerHTML = `
      * {
        color: rgb(0, 0, 0) !important;
        background-color: rgb(255, 255, 255) !important;
        border-color: rgb(0, 0, 0) !important;
        outline-color: rgb(0, 0, 0) !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }

      *::before,
      *::after {
        color: rgb(0, 0, 0) !important;
        background-color: rgb(255, 255, 255) !important;
        border-color: rgb(0, 0, 0) !important;
      }

      table {
        border-collapse: collapse !important;
      }

      td, th {
        page-break-inside: avoid !important;
      }
    `;
      document.head.appendChild(styleTag);

      await new Promise((r) => setTimeout(r, 100));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        backgroundColor: "#ffffff",
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          const clonedEl =
            clonedDoc.body.querySelector("[ref]") ||
            clonedDoc.body.firstElementChild;
          if (clonedEl) {
            clonedEl.style.width = "794px";
            clonedEl.style.maxWidth = "794px";

            // Force RGB colors in cloned document
            const allElements = clonedEl.querySelectorAll("*");
            allElements.forEach((elem) => {
              elem.style.color = "rgb(0, 0, 0)";
              elem.style.backgroundColor = "rgb(255, 255, 255)";
              elem.style.borderColor = "rgb(0, 0, 0)";
            });
          }
        },
      });

      const imgData = canvas.toDataURL("image/png", 1.0);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(
        imgData,
        "PNG",
        0,
        position,
        pdfWidth,
        imgHeight,
        undefined,
        "FAST",
      );
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(
          imgData,
          "PNG",
          0,
          position,
          pdfWidth,
          imgHeight,
          undefined,
          "FAST",
        );
        heightLeft -= pdfHeight;
      }

      pdf.save(`Invoice-${data.invoice.number.replace(/[/\\]/g, "_")}.pdf`);

      el.style.width = originalWidth;
      el.style.maxWidth = originalMaxWidth;
      el.style.padding = originalPadding;
      el.style.border = originalBorder;
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Check console for details.");
    } finally {
      if (styleTag && styleTag.parentNode) {
        document.head.removeChild(styleTag);
      }
      if (loadingDiv && loadingDiv.parentNode) {
        document.body.removeChild(loadingDiv);
      }
    }
  };

  // Calculate totals for display
  
  

  const calculateSubtotal = () => {
    return data.items.reduce(
      (sum, item) => sum + parseFloat(item.amount || 0),
      0,
    );
  };

  const formatCurrency = (value) => {
    if (!value) return "0.00";
    return parseFloat(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // to add in single hsn calc
  const buildHSNSummary = () => {
    const map = {};

    data.items.forEach((item) => {
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

  const hsnSummary = buildHSNSummary();

  // Function to render tax rows based on available tax data
  const renderTaxRows = () => {
    const rows = [];

    if (parseFloat(itemTotals.totalIGST) > 0) {
      rows.push(
        <tr key="igst">
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
            {data.igst}
          </td>
        </tr>,
      );
    } else {
      if (parseFloat(itemTotals.totalCGST) > 0) {
        rows.push(
          <tr key="cgst">
            <td
              colSpan="5"
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
                fontWeight: "bold",
              }}
            >
              Output CGST {data.taxRate}%
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              {data.cgst}
            </td>
          </tr>,
        );
      }

      if (parseFloat(itemTotals.totalSGST) > 0) {
        rows.push(
          <tr key="sgst">
            <td
              colSpan="5"
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
                fontWeight: "bold",
              }}
            >
              Output SGST {data.taxRate}%
            </td>
            <td
              style={{
                border: "1px solid #000",
                padding: "4px",
                textAlign: "right",
              }}
            >
              {data.sgst}
            </td>
          </tr>,
        );
      }
    }

    return rows;
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: "10px",
          padding: "10px",
          justifyContent: "flex-end",
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
        {/* <DownloadPDFButton invoiceData={data} /> */}
      </div>
      <div
        ref={containerRef}
        style={{
          fontFamily: "Arial, sans-serif",
          fontSize: "11px",
          maxWidth: "210mm",
          margin: "0 auto",
          padding: "6mm",
          background: "#fff",
          backgroundColor: "#fff",
          border: "1px solid #000",
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "3px",
            paddingBottom: "3px",
          }}
        >
          <h1 style={{ margin: "0", fontSize: "15px", fontWeight: "semibold" }}>
            Tax Invoice
          </h1>
        </div>
        {/* Company Details */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            border: "1px solid #000",
            borderBottom: "0px",
          }}
        >
          <tbody>
            <tr style={{ height: "110px" }}>
              {/* Left - Logo */}
              <td style={{ width: "25%" }}>
                <img
                  src="/logo.png"
                  style={{ width: 110, height: "auto", display: "block" }}
                  alt="logo"
                />
              </td>

              {/* Center - Company Details */}
              <td style={{ width: "75%" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "110px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      fontSize: "20px",
                      marginBottom: "4px",
                      marginTop: "4px",
                    }}
                  >
                    {data.company.name}
                  </div>

                  <div style={{ fontSize: "10px", marginBottom: "4px" }}>
                    {data.company.address}
                  </div>

                  <div style={{ fontSize: "10px", marginBottom: "3px" }}>
                    Ph: {data.company.phone}
                  </div>

                  <div style={{ fontSize: "10px", marginBottom: "6px" }}>
                    GST: {data.company.gstin}
                  </div>
                </div>
              </td>

              {/* Right Empty */}
              <td style={{ width: "25%" }}></td>
            </tr>
          </tbody>
        </table>

        {/* Invoice Info Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10px",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  border: "0.2px solid #000",
                  padding: "3px",
                  paddingBottom: "7px",
                  width: "33%",
                  fontWeight: "bold",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                Invoice No. : <span style={{
                  fontWeight: "normal",
                }}>{data.invoice.number}</span>
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "3px",
                  paddingBottom: "7px",
                  width: "33%",
                  fontWeight: "bold",
                  borderBottom: "0px",
                  borderRight: "0px",
                  marginBottom: "20px",
                }}
              >
                Invoice Date : <span style={{
                  fontWeight: "normal",
                }}>{data.invoice.orderDate}</span>
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "3px",
                  paddingBottom: "7px",
                  width: "34%",
                  fontWeight: "bold",
                  borderBottom: "0px",
                }}
              >
                Due Date : <span style={{
                  fontWeight: "normal",
                }}>{data.invoice.dueDate}</span>
              </td>
            </tr>
           
            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "3px",
                  paddingBottom: "7px",
                  borderBottom: "0px",
                  borderRight: "0px",
                 
                  
                }}
              >
                <b>Reference No. : <span style={{
                  fontWeight: "normal",
                  marginRight:"3px"
                }}>{data.invoice.referenceNo}</span></b>
                <b>Dt. : <span style={{
                  fontWeight: "normal",
                }}>{data.invoice.orderDate}</span></b>
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "3px",
                  paddingBottom: "7px",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                <b>Buyer's Order No. : <span style={{
                  fontWeight: "normal",
                }}>{data.invoice.buyersOrderNo}</span></b>
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "3px",
                  paddingBottom: "7px",
                  borderBottom: "0px",
                }}
              >
                <b>Order Date : <span style={{
                  fontWeight: "normal",
                }}>{data.invoice.orderDate}</span></b>
              </td>
            </tr>
           
            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "3px",
                  borderBottom: "0px",
                  paddingBottom: "7px",
                  borderRight: "0px",
                }}
              >
                <b>e-Way Bill No. : <span style={{
                  fontWeight: "normal",
                }}>{data.invoice.eWayBill}</span></b>
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "3px",
                  paddingBottom: "7px",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                <b>Payment Status : <span style={{
                  fontWeight: "normal",
                }}>{data.paymentInfo.status}</span></b>
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "3px",
                  paddingBottom: "7px",
                  borderBottom: "0px",
                }}
              >
                <b>Balance Amount : <span style={{
                  fontWeight: "normal",
                }}>{data.paymentInfo.balanceAmount}</span></b>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Buyer Consignee Table */}

<table
  style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10px",
          }}
>
  <tbody>
    <tr>
      {/* BUYER COLUMN */}
 <td
  style={{
    border: "1px solid #000",
    padding: "4px",              // increased padding
    width: "50%",
    borderBottom: "0px",
    verticalAlign: "top",
    wordBreak: "break-word",
    borderRight: "0px",
    whiteSpace: "normal",
    lineHeight: "1.5",           // slightly increased
    overflow: "visible"          // prevent clipping
  }}
>
  <span style={{ fontWeight: "bold", marginBottom: "4px", display: "block" }}>
    Buyer (Bill To) : {data.buyer.name}
  </span>

  <div
    style={{
      display: "flex",
      width: "100%",
      gap: "10px",
      marginBottom: "3px",
      flexWrap: "wrap",              // important fix
      alignItems: "flex-start"
    }}
  >
    <span style={{ fontWeight: "bold" }}>
      Address:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.buyer.address}
      </span>
    </span>

    <span style={{ fontWeight: "bold" }}>
      GSTIN:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.buyer.gstin || "22AAAAA0000A1Z5"}
      </span>
    </span>

    <span style={{ fontWeight: "bold" }}>
      State:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.buyer.state}
      </span>
    </span>
  </div>

  <div
    style={{
      display: "flex",
      width: "100%",
      gap: "10px",
      flexWrap: "wrap",              // important fix
      alignItems: "flex-start",
      marginBottom: "3px"
    }}
  >
    <span style={{ fontWeight: "bold" }}>
      Place of Supply:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.buyer.placeOfSupply}
      </span>
    </span>

    <span style={{ fontWeight: "bold" }}>
      Contact:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.buyer.contactPerson}
      </span>{" "}
      ({data.buyer.phone})
    </span>
  </div>

  <span style={{ fontWeight: "bold", display: "block",marginBottom: "1px" }}>
    Email:{" "}
    <span style={{ fontWeight: "normal" }}>
      {data.buyer.email}
    </span>
  </span>
</td>



      {/* CONSIGNEE COLUMN */}
  <td
  style={{
    border: "1px solid #000",
    padding: "4px",               // increased from 3px
    width: "50%",
    borderBottom: "0px",
    lineHeight: "1.5",            // reduced from 1.9 (too large causes clipping)
    verticalAlign: "top",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    whiteSpace: "normal",
    overflow: "visible"           // prevent cutting
  }}
>
  <p style={{ fontWeight: "bold", margin: 0, marginBottom: "4px" }}>
    Consignee (Ship To) : {data.consignee.name}
  </p>

  <div
    style={{
      display: "flex",
      width: "100%",
      gap: "10px",
      flexWrap: "wrap",           // IMPORTANT
      alignItems: "flex-start"
    }}
  >
    <p style={{ fontWeight: "bold", margin: 0 }}>
      Address:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.consignee.address}
      </span>
    </p>

    <p style={{ fontWeight: "bold", margin: 0 }}>
      GSTIN:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.consignee.gstin || "22AAAAA0000A1Z5"}
      </span>
    </p>

    <p style={{ fontWeight: "bold", margin: 0 }}>
      State:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.consignee.state}
      </span>
    </p>
  </div>

  <div
    style={{
      display: "flex",
      width: "100%",
      gap: "10px",
      flexWrap: "wrap",           // IMPORTANT
      alignItems: "flex-start",
      marginTop: "3px"
    }}
  >
    <p style={{ fontWeight: "bold", margin: 0 }}>
      Contact:{" "}
      <span style={{ fontWeight: "normal" }}>
        {data.consignee.contactPerson}
      </span>{" "}
      ({data.consignee.phone})
    </p>
  </div>
</td>





 
    </tr>
  </tbody>
</table>



        {/* Additional Info Row */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10px",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  width: "50%",
                  fontWeight: "bold",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                State Code : <span style={{ fontWeight: "normal" }}> {invoice.state_code || "12345"}</span>
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  width: "50%",
                  fontWeight: "bold",
                  borderBottom: "0px",
                }}
              >
                Amount Paid : <span style={{ fontWeight: "normal" }}> ₹{invoice.amountPaid || "0.00"}</span>
              </td>
            </tr>
            
            <tr>
              <td
                colSpan="2"
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  fontWeight: "bold",
                  borderBottom: "0px",
                }}
              >
                Notes : <span style={{ fontWeight: "normal" }}>{data.notes || ""}</span>
              </td>
            </tr>
            
          </tbody>
        </table>

        {/* Items Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "10px",
            fontSize: "10px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f0f0f0" }}>
              <th
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "left",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                Sl No.
              </th>
              <th
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "left",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                Description of Goods
              </th>
              <th
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "left",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                HSN/SAC
              </th>
              <th
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "center",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                Quantity
              </th>
              <th
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "right",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                Rate
              </th>
              <th
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "right",
                  borderBottom: "0px",
                }}
              >
                Amount
              </th>
            </tr>
          </thead>
       <tbody>
  {data.items.map((item) => (
    <tr key={item.sr_no}>
      <td
        style={{
          border: "1px solid #000",
          padding: "6px",                 // increased
          borderBottom: "0px",
          borderRight: "0px",
          verticalAlign: "top",
          lineHeight: "1.4",
        }}
      >
        {item.sr_no}
      </td>

      <td
        style={{
          border: "1px solid #000",
          padding: "3px 6px 6px 6px",   // increased padding
          borderBottom: "0px",
          borderRight: "0px",
          verticalAlign: "top",           // important
          wordBreak: "break-word",
          whiteSpace: "normal",
          lineHeight: "1.4",
        }}
      >
        <div style={{ fontWeight: "bold",
    lineHeight: "1.1",      // important
    paddingBottom: "4px",   // prevents bottom cutting
    display: "inline-block" }}>
          {item.description}
        </div>

        {item.fullDescription && (
          <div
            style={{
              fontSize: "8px",
              lineHeight: "1.3",
              wordBreak: "break-word",
              whiteSpace: "normal",
            }}
          >
            {item.fullDescription}
          </div>
        )}
      </td>

      <td
        style={{
          border: "1px solid #000",
          padding: "6px",
          borderBottom: "0px",
          borderRight: "0px",
          verticalAlign: "top",
          lineHeight: "1.4",
        }}
      >
        {item.hsn}
      </td>

      <td
        style={{
          border: "1px solid #000",
          padding: "6px",
          textAlign: "center",
          borderBottom: "0px",
          borderRight: "0px",
          verticalAlign: "top",
          lineHeight: "1.4",
        }}
      >
        {item.quantity}
      </td>

      <td
        style={{
          border: "1px solid #000",
          padding: "6px",
          textAlign: "right",
          borderBottom: "0px",
          borderRight: "0px",
          verticalAlign: "top",
          lineHeight: "1.4",
        }}
      >
        {formatCurrency(item.rate)}
      </td>

      <td
        style={{
          border: "1px solid #000",
          padding: "6px",
          textAlign: "right",
          borderBottom: "0px",
          verticalAlign: "top",
          lineHeight: "1.4",
        }}
      >
        {formatCurrency(item.amount)}
      </td>
    </tr>
  ))}

  {renderTaxRows()}

  <tr>
    <td
      colSpan="3"
      style={{
        border: "1px solid #000",
        padding: "6px",
        fontWeight: "bold",
        borderRight: "0px",
        lineHeight: "1.4",
      }}
    >
      Total
    </td>

    <td
      style={{
        border: "1px solid #000",
        padding: "6px",
        textAlign: "center",
        fontWeight: "bold",
        borderRight: "0px",
        lineHeight: "1.4",
      }}
    >
      {itemTotals.totalQuantity}
    </td>

    <td
      style={{
        border: "1px solid #000",
        padding: "6px",
        textAlign: "right",
        fontWeight: "bold",
        borderRight: "0px",
        lineHeight: "1.4",
      }}
    >
      ₹
    </td>

    <td
      style={{
        border: "1px solid #000",
        padding: "6px",
        textAlign: "right",
        fontWeight: "bold",
        lineHeight: "1.4",
      }}
    >
      {data.total}
    </td>
  </tr>
</tbody>

        </table>

        {/* Amount in Words */}
        <div style={{ marginBottom: "8px", fontSize: "9px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
            Amount Chargeable (in words) E. & O.E
          </div>
          <br />
          <strong>INR- {numberToWords(data.total)}</strong>
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
                  textAlign: "center",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                HSN/SAC
              </th>
              <th
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "center",
                  borderBottom: "0px",
                  borderRight: "0px",
                }}
              >
                Taxable Value
              </th>
              {parseFloat(itemTotals.totalIGST) > 0 ? (
                <>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    IGST
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    Rate
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    Amount
                  </th>
                </>
              ) : (
                <>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    CGST
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    Rate
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    Amount
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    SGST/UTGST
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    Rate
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderBottom: "0px",
                      borderRight: "0px",
                    }}
                  >
                    Amount
                  </th>
                </>
              )}
              <th
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "center",
                  borderBottom: "0px",
                }}
              >
                Total Tax Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {hsnSummary.map((row, idx) => (
              <tr key={idx}>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "4px",
                    borderBottom: "0px",
                    textAlign: "center",
                    borderRight: "0px",
                  }}
                >
                  {row.hsn}
                </td>

                <td
                  style={{
                    border: "1px solid #000",
                    padding: "4px",
                    textAlign: "center",
                    borderBottom: "0px",
                    borderRight: "0px",
                  }}
                >
                  {formatCurrency(row.taxableValue)}
                </td>

                {parseFloat(itemTotals.totalIGST) > 0 ? (
                  <>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                      }}
                    >
                      IGST
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                      }}
                    >
                      {row.igstPercent}%
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                      }}
                    >
                      {formatCurrency(row.igst)}
                    </td>
                  </>
                ) : (
                  <>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                        borderBottom: "0px",
                        borderRight: "0px",
                      }}
                    >
                      CGST
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                        borderBottom: "0px",
                        borderRight: "0px",
                      }}
                    >
                      {row.cgstPercent}%
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                        borderBottom: "0px",
                        borderRight: "0px",
                      }}
                    >
                      {formatCurrency(row.cgst)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                        borderBottom: "0px",
                        borderRight: "0px",
                      }}
                    >
                      SGST/UTGST
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                        borderBottom: "0px",
                        borderRight: "0px",
                      }}
                    >
                      {row.sgstPercent}%
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                        borderBottom: "0px",
                        borderRight: "0px",
                      }}
                    >
                      {formatCurrency(row.sgst)}
                    </td>
                  </>
                )}

                <td
                  style={{
                    border: "1px solid #000",
                    padding: "4px",
                    textAlign: "center",
                    borderBottom: "0px",
                  }}
                >
                  {parseFloat(itemTotals.totalIGST) > 0
                    ? formatCurrency(row.igst)
                    : formatCurrency(row.cgst + row.sgst)}
                </td>
              </tr>
            ))}

            {/* TOTAL ROW */}
            <tr style={{ fontWeight: "bold" }}>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  borderRight: "0px",
                  textAlign: "center",
                  marginBottom:"2px"
                }}
              >
                Total
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "center",
                  borderRight: "0px",
                }}
              >
                {data.subtotal}
              </td>
              {parseFloat(itemTotals.totalIGST) > 0 ? (
                <>
                  <td
                    colSpan="2"
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderRight: "0px",
                    }}
                  ></td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderRight: "0px",
                    }}
                  >
                    {data.igst}
                  </td>
                </>
              ) : (
                <>
                  <td
                    colSpan="2"
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderRight: "0px",
                    }}
                  ></td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderRight: "0px",
                    }}
                  >
                    {data.cgst}
                  </td>
                  <td
                    colSpan="2"
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderRight: "0px",
                    }}
                  ></td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      borderRight: "0px",
                    }}
                  >
                    {data.sgst}
                  </td>
                </>
              )}
              <td
                style={{
                  border: "1px solid #000",
                  padding: "4px",
                  textAlign: "center",
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
            Tax Amount (in words) : INR- {numberToWords(data.taxAmount)}
          </strong>
        </div>

        {/* Terms & Bank Details */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "15px" }}>
          <div style={{ flex: "1", fontSize: "9px" }}>
            <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
              Terms & Condition
            </div>
            {data.terms.length > 0 ? (
              data.terms.map((term, index) => (
                <div key={index} style={{ marginBottom: "3px" }}>
                  {term}
                </div>
              ))
            ) : (
              <div>No terms and conditions specified.</div>
            )}
          </div>
          <div style={{ width: "250px", fontSize: "9px" }}>
            <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
              Company's Bank Details
            </div>
            <div style={{ fontSize: "10px", marginBottom: "2px" }}>
              A/C Holder Name : {data.bank.accountHolderName}
            </div>
            <div style={{ fontSize: "10px", marginBottom: "2px" }}>
              Bank Name : {data.bank.name}
            </div>
            <div style={{ fontSize: "10px", marginBottom: "2px" }}>
              A/c No. : {data.bank.accountNo}
            </div>
            <div style={{ fontSize: "10px", marginBottom: "2px" }}>
              Branch & IFS Code: {data.bank.IFSC}
            </div>
          </div>
        </div>

        {/* Signature */}
       <div
  style={{
    textAlign: "right",
    marginTop: "40px",
    fontSize: "9px",
  }}
>
  <div>for {data.company.name}</div>

  {/* Signature Image */}
  <div
    style={{
      marginTop: "20px",
      display: "flex",
      justifyContent: "flex-end",
    }}
  >
    <img
      src={signImg.src}
      alt="Signature"
      style={{
        height: "60px",
        width: "120px",
        objectFit: "contain",
      }}
    />
  </div>

  {/* Signatory Text */}
  <div
    style={{
      marginTop: "5px",
      marginRight: "12px",
      fontWeight: "bold",
    }}
  >
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
      </div>
      {/* <div style={{ width: "80%", marginTop: "20px" }}>
        <InvoicePDFPreview invoiceData={data} />
      </div> */}
    </>
  );
};

export default NewInvoice;
