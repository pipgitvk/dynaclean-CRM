"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import dayjs from "dayjs";
import { generateServiceReportPDF, downloadPDF } from "@/utils/pdfGenerator";
import "./print.css";

// Lightweight image component with prioritized fallbacks for signatures
function ImageWithFallback({ src, alt, className, id }) {
  const getFilename = (input) => {
    if (!input) return null;
    try {
      const url = new URL(input, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      const parts = url.pathname.split("/");
      return parts[parts.length - 1] || null;
    } catch {
      const parts = String(input).split("/");
      return parts[parts.length - 1] || null;
    }
  };

  const filename = getFilename(src);

  const candidates = [];
  if (filename) {
    candidates.push(
      `https://service.dynacleanindustries.com/signatures/${filename}`,
      `https://app.dynacleanindustries.com/signatures/${filename}`
    );
  }
  if (src) candidates.push(src);
  if (filename) candidates.push(`/signatures/${filename}`);
  candidates.push("");

  const [index, setIndex] = useState(0);
  const activeSrc = candidates[index] || "";

  return (
    <img
      id={id}
      src={activeSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (index < candidates.length - 1) setIndex(index + 1);
      }}
    />
  );
}

const CHECKLIST_ITEMS = [
  "Voltage (V)",
  "Condition of Motor",
  "Check Squeegee blades / Adjust",
  "Amperages (Amps)",
  "Greasing Cleaned / Done",
  "Condition of Handle",
  "Switches Checked",
  "Filters Cleaned / Checked",
  "Condition of Wheels",
  "Condition of Elec Cable",
  "Condition of Belt",
  "Check Oil / TOP UP Done",
  "Fuse Checked",
  "Condition of Coupling / Drive Disk",
  "Check Battery Condition / Electrolyte",
  "Condition of Carbon Brush",
  "Condition of Rubber Brush",
  "Check Brush Condition",
];

const formatDate = (date) => {
  return date ? dayjs(date).format("YYYY-MM-DD") : "-";
};

export default function ViewServiceReport({ params }) {
  const [report, setReport] = useState(null);
  const [product, setProduct] = useState(null);
  const [install, setInstall] = useState({});
  const [loading, setLoading] = useState(true);
  const [trainees, setTrainees] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { service_id } = React.use(params);
  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(
          `/api/service-records/${service_id}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setReport(data.record || {});
        setProduct(data.product || {});
        setInstall(data.install || {});
        console.log("this is the data:", data);
        if (data.install) {
          const transformedTrainees = transformTraineeData(data.install);
          setTrainees(transformedTrainees);
        }
      } catch (error) {
        console.error("Failed to fetch report:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [service_id]);

  const transformTraineeData = (installData) => {
    const names = installData.trainee_names
      ? installData.trainee_names.split(",")
      : [];
    const designations = installData.trainee_departments
      ? installData.trainee_departments.split(",")
      : [];
    const contacts = installData.trainee_contacts
      ? installData.trainee_contacts.split(",")
      : [];

    const traineesArray = [];
    for (let i = 0; i < names.length; i++) {
      traineesArray.push({
        id: i, // Use index as a temporary key if no unique ID is available
        name: names[i] ? names[i].trim() : "",
        designation: designations[i] ? designations[i].trim() : "",
        contact: contacts[i] ? contacts[i].trim() : "",
      });
    }
    return traineesArray;
  };
  const handlePrint = () => {
    const printContent = document
      .getElementById("print-content")
      .cloneNode(true);
    const printWindow = window.open("", "_blank", "height=600,width=800");
    printWindow.document.write("<html><head><title>Service Report</title>");
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return sheet.cssRules
            ? Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join("")
            : "";
        } catch (e) {
          return "";
        }
      })
      .join("");
    printWindow.document.write("<style>" + styles + "</style>");
    printWindow.document.write("</head><body>");
    printWindow.document.write(printContent.outerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const getFilename = (input) => {
    if (!input) return null;
    try {
      const url = new URL(input, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      const parts = url.pathname.split("/");
      return parts[parts.length - 1] || null;
    } catch {
      const parts = String(input).split("/");
      return parts[parts.length - 1] || null;
    }
  };

  const handleDownloadPDF = async () => {
    if (!report || !product) return;

    setIsGeneratingPDF(true);
    try {
      // Resolve filenames for signatures (works for filename, path, or full URL)
      const engineerFilename = getFilename(report.authorised_person_sign);
      const customerFilename = getFilename(report.customer_sign);

      // Try to fetch signatures via server-side proxy to avoid CORS issues
      let engineerSignData = null;
      let customerSignData = null;

      try {
        if (engineerFilename) {
          const res = await fetch(`/api/signature-proxy?filename=${encodeURIComponent(engineerFilename)}`);
          if (res.ok) {
            const json = await res.json();
            engineerSignData = json.dataUrl || null;
          }
        }
      } catch (e) {
        console.error("Failed to fetch engineer signature via proxy", e);
      }

      try {
        if (customerFilename) {
          const res = await fetch(`/api/signature-proxy?filename=${encodeURIComponent(customerFilename)}`);
          if (res.ok) {
            const json = await res.json();
            customerSignData = json.dataUrl || null;
          }
        }
      } catch (e) {
        console.error("Failed to fetch customer signature via proxy", e);
      }

      const pdfData = {
        service_id: report.service_id,
        serial_number: report.serial_number,
        status: report.status,
        complaint_date: report.complaint_date,
        complaint_number: report.complaint_number,
        service_type: report.service_type,
        reg_date: report.reg_date,
        completed_date: report.completed_date,
        checklist: report.checklist,
        nature_of_complaints: report.nature_of_complaints,
        observation: report.observation,
        action_taken: report.action_taken,
        complaint_summary: report.complaint_summary,
        completion_remark: report.completion_remark,
        replaced: report.replaced,
        to_be_replaced: report.to_be_replaced,
        service_rate: report.service_rate,
        feedback: report.feedback,
        authorised_person_name: report.authorised_person_name,
        authorised_person_designation: report.authorised_person_designation,
        authorised_person_mobile: report.authorised_person_mobile,
        authorised_person_sign: report.authorised_person_sign,
        authorised_person_sign_data: engineerSignData,
        customer_name: report.customer_name,
        customer_designation: report.customer_designation,
        customer_mobile: report.customer_mobile,
        customer_sign: report.customer_sign,
        customer_sign_data: customerSignData,
      };

      const productData = {
        product_name: product.product_name,
        model: product.model,
        customer_name: product.customer_name,
        email: product.email,
        contact: product.contact,
        customer_address: product.customer_address,
        installed_address: product.installed_address,
        installation_date: product.installation_date,
        invoice_number: product.invoice_number,
        invoice_date: product.invoice_date,
      };

      let installData = null;
      if (report.service_type === "INSTALLATION" && install) {
        installData = {
          defects_on_inspection: install.defects_on_inspection,
          engineer_remarks: install.engineer_remarks,
        };
      }

      console.log("🔍 PDF Data Debug:", {
        pdfData,
        productData,
        installData,
        trainees,
        checklist: report.checklist,
        service_rate: report.service_rate
      });

      const pdf = await generateServiceReportPDF(pdfData, productData, installData, trainees);
      const filename = `Service_Report_${report.service_id}_${dayjs().format('YYYY-MM-DD')}.pdf`;

      downloadPDF(pdf, filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg">
        Loading report...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 font-semibold">
        Report not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 md:p-8 flex items-center justify-center">
      <div className="bg-white border border-gray-200 shadow-xl rounded-lg p-4 sm:p-6 w-full md:max-w-6xl">
        <div id="print-content">
          {/* Header */}
          <header className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-8 pb-2 sm:pb-4 border-b-2 border-gray-200 text-center sm:text-left">
            <div className="mb-2 sm:mb-0 sm:w-1/4 flex-shrink-0">
              <img
                src="/images/logo.png"
                alt="Dynaclean Industries Logo"
                width={120}
                height={120}
                className="mx-auto sm:mx-0"
              />
            </div>
            <div className="sm:w-3/4">
              <h1 className="text-xl sm:text-3xl font-bold text-red-700">
                DYNACLEAN INDUSTRIES
              </h1>
              <address className="not-italic text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">
                1ST Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,
                Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu, Pin: 641006.
              </address>
              <div className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">
                <p>
                  Email:{" "}
                  <a
                    href="mailto:service@dynacleanindustries.com"
                    className="text-blue-600 hover:underline"
                  >
                    service@dynacleanindustries.com
                  </a>
                  ,{" "}
                  <a
                    href="mailto:sales@dynacleanindustries.com"
                    className="text-blue-600 hover:underline"
                  >
                    sales@dynacleanindustries.com
                  </a>
                </p>
                <p>Phone: 011-45143666, +91-9205551085, +91-7982456944</p>
              </div>
            </div>
          </header>

          {/* Report Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 my-4 sm:my-6">
            SERVICE REPORT
          </h2>

          {/* Info Grid (Responsive) */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">
              PRODUCT & CUSTOMER DETAILS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-6">
              <ReadRow label="Service ID" value={report.service_id} />
              <ReadRow
                label="Service Date"
                value={formatDate(report.complaint_date)}
              />
              <ReadRow
                label="Complaint Number"
                value={report.complaint_number}
              />
              <ReadRow label="Service Type" value={report.service_type} />
              <ReadRow label="Serial Number" value={report.serial_number} />
              <ReadRow label="Status" value={report.status} />
              <ReadRow
                label="Registration Date"
                value={formatDate(report.reg_date)}
              />
              <ReadRow
                label="Completed Date"
                value={formatDate(report.completed_date)}
              />
              <ReadRow label="Product Name" value={product.product_name} />
              <ReadRow label="Model" value={product.model} />
              <ReadRow label="Customer Name" value={product.customer_name} />
              <ReadRow label="Email" value={product.email} />
              <ReadRow label="Contact" value={product.contact} />
              <ReadRow
                label="Customer Address"
                value={product.customer_address}
              />
              <ReadRow
                label="Installed Address"
                value={product.installed_address}
              />
              <ReadRow
                label="Installation Date"
                value={formatDate(product.installation_date)}
              />
              <ReadRow label="Invoice Number" value={product.invoice_number} />
              <ReadRow
                label="Invoice Date"
                value={formatDate(product.invoice_date)}
              />
            </div>
          </div>

          {/* Checklist (Responsive) */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">
              CHECKLIST
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              {CHECKLIST_ITEMS.map((item, index) => (
                <div key={index} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={
                      report && report.checklist
                        ? report.checklist.includes(item)
                        : false
                    }
                    readOnly
                    className="mr-2 h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-900">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* new part for the details */}

          {report.service_type === "INSTALLATION" && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Defects Found on Inspection
                </label>
                <p className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-900 bg-gray-50 break-words">
                  {install.defects_on_inspection || "N/A"}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Engineer's Remark
                </label>
                <p className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-900 bg-gray-50 break-words">
                  {install.engineer_remarks || "N/A"}
                </p>
              </div>
              <div className=" mx-auto bg-white shadow-xl rounded-lg p-4 sm:p-6 mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Trainees Present
                </h3>
                <div className="overflow-x-auto">
                  <table
                    className="min-w-full text-left border-collapse"
                    id="traineesTable"
                  >
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 rounded-tl-lg">
                          S. No.
                        </th>
                        <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                          Name of Trainees
                        </th>
                        <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                          Designation
                        </th>
                        <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 rounded-tr-lg">
                          Contact No.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainees.length > 0 ? (
                        trainees.map((trainee, index) => (
                          <tr
                            key={trainee.id || index}
                            className="border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200"
                          >
                            <td className="p-2 sm:p-3 text-gray-600">
                              {index + 1}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-800">
                              {trainee.name}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-800">
                              {trainee.designation}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-800">
                              {trainee.contact}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="4"
                            className="p-4 text-center text-gray-500"
                          >
                            No trainees recorded for this installation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* end of new part */}

          {/* Service Rendered (Responsive) */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">SERVICE RENDERED</h3>
            <div className="grid grid-cols-1 gap-4">
              <ReadRow
                label="Nature of Complaint"
                value={report.nature_of_complaints}
              />
              <ReadRow label="Observation" value={report.observation} />
              <ReadRow label="Action Taken" value={report.action_taken} />
              <ReadRow
                label="Complaint Summary"
                value={report.complaint_summary}
              />
              <ReadRow
                label="Completion Remark"
                value={report.completion_remark}
              />
            </div>
          </div>

          {/* Spare Parts & Feedback (Responsive) */}
          <div className="mb-6 p-4 border rounded-md">
            <h3 className="text-lg font-semibold mb-3">SPARE PARTS DETAILS</h3>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300 border border-gray-400 text-sm">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border px-2 py-1">S. No.</th>
                    <th className="border px-2 py-1">REPLACED</th>
                    <th className="border px-2 py-1">TO BE REPLACED</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const replacedItems = report.replaced ? report.replaced.split(',').map(item => item.trim()).filter(item => item) : [];
                    const toBeReplacedItems = report.to_be_replaced ? report.to_be_replaced.split(',').map(item => item.trim()).filter(item => item) : [];
                    const maxRows = Math.max(replacedItems.length, toBeReplacedItems.length);

                    if (maxRows === 0) {
                      return (
                        <tr>
                          <td className="border px-2 py-1">1</td>
                          <td className="border px-2 py-1">-</td>
                          <td className="border px-2 py-1">-</td>
                        </tr>
                      );
                    }

                    return Array.from({ length: maxRows }, (_, index) => (
                      <tr key={index}>
                        <td className="border px-2 py-1">{index + 1}</td>
                        <td className="border px-2 py-1">
                          {replacedItems[index] || "-"}
                        </td>
                        <td className="border px-2 py-1">
                          {toBeReplacedItems[index] || "-"}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile View as stacked cards */}
            <div className="sm:hidden grid grid-cols-1 gap-4">
              <div className="border rounded p-3">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Replaced Items:</label>
                {report.replaced ? (
                  <ul className="list-disc list-inside space-y-1">
                    {report.replaced.split(',').map((item, index) => (
                      <li key={index} className="text-sm text-gray-900">
                        {item.trim()}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-900">-</p>
                )}
              </div>
              <div className="border rounded p-3">
                <label className="text-sm font-medium text-gray-600 mb-2 block">To Be Replaced Items:</label>
                {report.to_be_replaced ? (
                  <ul className="list-disc list-inside space-y-1">
                    {report.to_be_replaced.split(',').map((item, index) => (
                      <li key={index} className="text-sm text-gray-900">
                        {item.trim()}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-900">-</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">FEEDBACK</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ReadRow label="Service Rating" value={report.service_rate} />
                <ReadRow label="Customer Feedback" value={report.feedback} />
              </div>
            </div>
          </div>

          {/* Signatures (Responsive) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-6 signature-wrapper">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Authorized Person (Engineer)
              </h3>
              {report.authorised_person_sign && (
                <ImageWithFallback
                  id="engineer-signature-img"
                  src={report.authorised_person_sign}
                  alt="Engineer Signature"
                  className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                />
              )}
              <ReadRow
                label="Name"
                value={report.authorised_person_name || "N/A"}
              />
              <ReadRow
                label="Designation"
                value={report.authorised_person_designation}
              />
              <ReadRow label="Mobile" value={report.authorised_person_mobile} />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Customer</h3>
              {report.customer_sign && (
                <ImageWithFallback
                  id="customer-signature-img"
                  src={report.customer_sign}
                  alt="Customer Signature"
                  className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                />
              )}
              <ReadRow label="Name" value={report.customer_name || "N/A"} />
              <ReadRow
                label="Designation"
                value={report.customer_designation}
              />
              <ReadRow label="Mobile" value={report.customer_mobile} />
            </div>
          </div>
        </div>

        {/* Print and Download Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center sm:justify-end mt-8 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Print Report
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-semibold rounded-md shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ReadRow = ({ label, value }) => (
  <div className="flex flex-col">
    <label className="text-xs sm:text-sm font-medium text-gray-600">
      {label}:
    </label>
    <p className="text-sm sm:text-base text-gray-900 font-medium">
      {value || "-"}
    </p>
  </div>
);
