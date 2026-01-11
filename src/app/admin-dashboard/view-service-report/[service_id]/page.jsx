"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import dayjs from "dayjs";

// Lightweight image component with prioritized fallbacks for signatures
function ImageWithFallback({ src, alt, className }) {
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
  candidates.push("/images/sign.png");

  const [index, setIndex] = useState(0);
  const activeSrc = candidates[index] || "/images/sign.png";

  return (
    <img
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/generate-report/service/${params.service_id}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setReport(data?.data || {});
      } catch (error) {
        console.error("Failed to fetch report:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [params.service_id]);

  const handlePrint = () => {
    // Clone the content to prepare it for a new window
    const printContent = document
      .getElementById("print-content")
      .cloneNode(true);

    // Create a new window for printing
    const printWindow = window.open("", "_blank", "height=600,width=800");
    printWindow.document.write("<html><head><title>Service Report</title>");

    // Copy the current page's styles to the new window
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return sheet.cssRules
            ? Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join("")
            : "";
        } catch (e) {
          console.error("Error accessing stylesheet:", e);
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

    // Wait for the content to be loaded and then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
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
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 flex items-center justify-center">
      <div className="bg-white border border-gray-200 shadow-xl rounded-lg p-6 w-full max-w-6xl">
        <div id="print-content">
          {/* Header */}
          <header className="flex flex-col sm:flex-row items-center justify-between mb-8 pb-4 border-b-2 border-gray-200">
            <div className="mb-4 sm:mb-0 sm:w-1/4 flex-shrink-0">
              <img
                src="/images/logo.png"
                alt="Dynaclean Industries Logo"
                width={120}
                height={120}
                className="mx-auto sm:mx-0"
              />
            </div>
            <div className="sm:w-3/4 text-center sm:text-right">
              <h1 className="text-2xl sm:text-3xl font-bold text-red-700">
                DYNACLEAN INDUSTRIES
              </h1>
              <address className="not-italic text-sm text-gray-600 mt-2">
                1ST Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,
                Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu, Pin: 641006.
              </address>
              <div className="text-sm text-gray-600 mt-2">
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
          <h2 className="text-2xl font-bold text-center text-gray-800 my-6">
            SERVICE REPORT
          </h2>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 p-4 border rounded-md bg-gray-50 text-sm">
            <ReadRow
              label="Service Date"
              value={formatDate(report.complaint_date)}
            />
            <ReadRow label="Report ID" value={report.service_id} />
            <ReadRow label="Customer Name" value={report.customer_name} />
            <ReadRow label="Address" value={report.customer_address} />
            <ReadRow
              label="Installation Address"
              value={report.installed_address}
            />
            <ReadRow
              label="Invoice Date"
              value={formatDate(report.invoice_date)}
            />
            <ReadRow label="Invoice No" value={report.invoice_number} />
            <ReadRow label="Serial" value={report.serial_number} />
            <ReadRow label="Contact Person" value={report.contact_person} />
            <ReadRow label="Product Name" value={report.product_name} />
            <ReadRow label="Contact Number" value={report.contact} />
            <ReadRow label="Model" value={report.model} />
            <ReadRow label="Email" value={report.email} />
          </div>

          {/* Checklist */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">
              CHECKLIST
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {CHECKLIST_ITEMS.map((item, index) => (
                <div key={index} className="text-sm">
                  <input
                    type="checkbox"
                    checked={report.checklist?.includes(item)}
                    readOnly
                    className="mr-2"
                  />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Service Rendered */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">SERVICE RENDERED</h3>
            <ReadRow
              label="Nature of Complaint"
              value={report.nature_of_complaint}
            />
            <ReadRow label="Observation" value={report.observation} />
            <ReadRow label="Action Taken" value={report.action_taken} />
          </div>

          {/* Spare Parts */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">SPARE PARTS DETAILS</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S. No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      REPLACED
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TO BE REPLACED
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.from(
                    {
                      length: Math.max(
                        report.spare_replaced?.length || 0,
                        report.spare_to_be_replaced?.length || 0
                      ),
                    },
                    (_, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4">{index + 1}</td>
                        <td className="px-6 py-4">
                          {report.spare_replaced?.[index] || "-"}
                        </td>
                        <td className="px-6 py-4">
                          {report.spare_to_be_replaced?.[index] || "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <ReadRow
                label="Service Rating"
                value={report.service_rating?.replace(/([A-Z])/g, " $1")}
              />
              <ReadRow
                label="Customer Feedback"
                value={report.customer_feedback}
              />
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Authorized Person (Engineer)
              </h3>
              {report.authorized_person_sign && (
                <ImageWithFallback
                  src={report.authorized_person_sign}
                  alt="Engineer Signature"
                  className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                />
              )}
              <ReadRow label="Name" value={report.authorized_person_name} />
              <ReadRow
                label="Designation"
                value={report.authorized_person_designation}
              />
              <ReadRow label="Mobile" value={report.authorized_person_mobile} />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Customer</h3>
              {report.customer_sign && (
                <ImageWithFallback
                  src={report.customer_sign}
                  alt="Customer Signature"
                  className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                />
              )}
              <ReadRow label="Name" value={report.customer_name} />
              <ReadRow
                label="Designation"
                value={report.customer_designation}
              />
              <ReadRow label="Mobile" value={report.customer_mobile} />
            </div>
          </div>
        </div>

        {/* Print Button */}
        <div className="flex justify-end mt-8 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}

const ReadRow = ({ label, value }) => (
  <div className="flex flex-col">
    <label className="text-sm font-medium text-gray-600">{label}:</label>
    <p className="text-gray-900 font-medium">{value || "-"}</p>
  </div>
);
