"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import SignaturePad from "signature_pad";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

// Checklist items from your PHP code
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

// Helper function to format date strings for HTML date inputs
const formatDateForInput = (dateString) => {
  if (!dateString) return "";
  const date = dayjs(dateString);
  return date.isValid() ? date.format("YYYY-MM-DD") : "";
};

export default function ServiceReportForm({ initialData }) {
  const reportData = initialData?.data || {};
  const [formData, setFormData] = useState({
    ...reportData,
    complaint_date: formatDateForInput(reportData.complaint_date),
    invoice_date: formatDateForInput(reportData.invoice_date),
    installation_date: formatDateForInput(reportData.installation_date),
  });

  const [spareParts, setSpareParts] = useState(
    initialData?.spare_replaced?.map((replaced, index) => ({
      replaced,
      tobereplaced: initialData.spare_to_be_replaced[index] || "",
    })) || [{ replaced: "", tobereplaced: "" }]
  );
  const [submitted, setSubmitted] = useState(!!initialData.service_reports_id);
  const engineerSignaturePadRef = useRef(null);
  const customerSignaturePadRef = useRef(null);
  const engineerCanvasRef = useRef(null);
  const customerCanvasRef = useRef(null);

  const resizeCanvas = (canvas) => {
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
  };

  useEffect(() => {
    if (!submitted) {
      if (engineerCanvasRef.current) {
        resizeCanvas(engineerCanvasRef.current);
        engineerSignaturePadRef.current = new SignaturePad(
          engineerCanvasRef.current
        );
      }
      if (customerCanvasRef.current) {
        resizeCanvas(customerCanvasRef.current);
        customerSignaturePadRef.current = new SignaturePad(
          customerCanvasRef.current
        );
      }
    }
  }, [submitted]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === "checkbox" ? (checked ? value : "") : value,
    }));
  };

  const handleChecklistChange = (e) => {
    const { name, checked } = e.target;
    const item = name.replace("checklist_", "");
    const newChecklist = checked
      ? [...(formData.checklist || []), item]
      : (formData.checklist || []).filter((i) => i !== item);

    setFormData((prevData) => ({
      ...prevData,
      checklist: newChecklist,
    }));
  };

  const handleSparePartChange = (index, e) => {
    const { name, value } = e.target;
    const newSpareParts = [...spareParts];
    newSpareParts[index][name] = value;
    setSpareParts(newSpareParts);
  };

  const addSparePartRow = () => {
    if (spareParts.length < 5) {
      setSpareParts([...spareParts, { replaced: "", tobereplaced: "" }]);
    }
  };

  const clearSignature = (type) => {
    if (type === "engineer" && engineerSignaturePadRef.current) {
      engineerSignaturePadRef.current.clear();
    }
    if (type === "customer" && customerSignaturePadRef.current) {
      customerSignaturePadRef.current.clear();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitted) return;

    if (
      engineerSignaturePadRef.current?.isEmpty() ||
      customerSignaturePadRef.current?.isEmpty()
    ) {
      alert("Please provide both signatures before submitting.");
      return;
    }

    const formDataToSubmit = new FormData();
    formDataToSubmit.append("service_date", formData.complaint_date);
    formDataToSubmit.append(
      "engineerName",
      formData.authorized_person_name || ""
    );
    formDataToSubmit.append(
      "engDesignation",
      formData.authorized_person_designation || ""
    );
    formDataToSubmit.append(
      "engContact",
      formData.authorized_person_mobile || ""
    );
    formDataToSubmit.append("customerName", formData.customer_name || "");
    formDataToSubmit.append("customerName1", formData.customer_name1 || "");
    formDataToSubmit.append(
      "customerDesignation",
      formData.customer_designation || ""
    );
    formDataToSubmit.append("customerMobile", formData.customer_mobile || "");
    formDataToSubmit.append(
      "natureOfComplaint",
      formData.nature_of_complaint || ""
    );
    formDataToSubmit.append("observation", formData.observation || "");
    formDataToSubmit.append("actionTaken", formData.action_taken || "");
    formDataToSubmit.append("serviceRating", formData.service_rating || "");
    formDataToSubmit.append(
      "customerFeedback",
      formData.customer_feedback || ""
    );

    spareParts.forEach((part, index) => {
      if (part.replaced) {
        formDataToSubmit.append(`replaced${index + 1}`, part.replaced);
      }
      if (part.tobereplaced) {
        formDataToSubmit.append(`tobereplaced${index + 1}`, part.tobereplaced);
      }
    });

    formDataToSubmit.append("checklist", (formData.checklist || []).join(","));

    formDataToSubmit.append(
      "engineerSignature",
      engineerSignaturePadRef.current?.toDataURL() || ""
    );
    formDataToSubmit.append(
      "customerSignature",
      customerSignaturePadRef.current?.toDataURL() || ""
    );

    try {
      const res = await fetch(
        `/api/generate-report/service/${formData.service_id}`,
        {
          method: "POST",
          body: formDataToSubmit,
        }
      );

      const result = await res.json();
      if (res.ok) {
        alert(result.message);
        setSubmitted(true);
      } else {
        alert("Error: " + result.message);
      }
    } catch (error) {
      console.error("Submission Error:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const handlePrint = () => {
    // Clone the content to prepare it for a new window
    const printContent = document
      .getElementById("print-content")
      .cloneNode(true);

    // Convert signature canvases to images before printing
    if (
      engineerSignaturePadRef.current &&
      !engineerSignaturePadRef.current.isEmpty()
    ) {
      const engineerImage = engineerSignaturePadRef.current.toDataURL();
      if (engineerImage) {
        const img = document.createElement("img");
        img.src = engineerImage;
        img.alt = "Engineer Signature";
        img.className =
          "w-full h-auto object-contain border border-gray-300 rounded-md mb-4";
        const canvasWrapper = printContent.querySelector(
          ".engineer-signature-placeholder"
        );
        if (canvasWrapper) {
          canvasWrapper.parentNode.replaceChild(img, canvasWrapper);
        }
      }
    }

    if (
      customerSignaturePadRef.current &&
      !customerSignaturePadRef.current.isEmpty()
    ) {
      const customerImage = customerSignaturePadRef.current.toDataURL();
      if (customerImage) {
        const img = document.createElement("img");
        img.src = customerImage;
        img.alt = "Customer Signature";
        img.className =
          "w-full h-auto object-contain border border-gray-300 rounded-md mb-4";
        const canvasWrapper = printContent.querySelector(
          ".customer-signature-placeholder"
        );
        if (canvasWrapper) {
          canvasWrapper.parentNode.replaceChild(img, canvasWrapper);
        }
      }
    }

    // Now, populate the form fields with the current state data
    const inputs = printContent.querySelectorAll("input, textarea");
    inputs.forEach((input) => {
      const name = input.name;
      if (formData[name]) {
        input.value = formData[name];
      }
    });

    // --- Start of Fix: Handling Checkboxes and Radio Buttons ---
    const checkboxes = printContent.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      const item = checkbox.name.replace("checklist_", "");
      if (formData.checklist?.includes(item)) {
        checkbox.setAttribute("checked", "checked");
      } else {
        checkbox.removeAttribute("checked");
      }
    });

    const radioButtons = printContent.querySelectorAll('input[type="radio"]');
    radioButtons.forEach((radio) => {
      if (radio.value === formData.serviceRating) {
        radio.setAttribute("checked", "checked");
      } else {
        radio.removeAttribute("checked");
      }
    });
    // --- End of Fix ---

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

  return (
    <div className="min-h-screen bg-gray-100 md:p-4 flex items-center justify-center print-wrapper">
      <div
        id="print-content"
        className="bg-white border border-gray-200 shadow-xl rounded-lg md:p-6 print-wrapper"
      >
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

        <form onSubmit={handleSubmit}>
          <h2 className="text-2xl font-bold text-center text-gray-800 my-6">
            SERVICE REPORT
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6 p-4 border rounded-md bg-gray-50">
            <FormInput
              label="Service Date"
              name="complaint_date"
              type="date"
              value={formData.complaint_date}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Report ID"
              name="service_id"
              value={formData.service_id}
              readOnly
              disabled
            />
            <FormInput
              label="Customer Name"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Address"
              name="customer_address"
              value={formData.customer_address}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Installation Address"
              name="installed_address"
              value={formData.installed_address}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Invoice Date"
              name="invoice_date"
              type="date"
              value={formData.invoice_date}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Invoice No"
              name="invoice_number"
              value={formData.invoice_number}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Serial"
              name="serial_number"
              value={formData.serial_number}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Contact Person"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Product Name"
              name="product_name"
              value={formData.product_name}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Contact Number"
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Model"
              name="model"
              value={formData.model}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
            <FormInput
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              readOnly={submitted}
              required
            />
          </div>

          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">
              CHECKLIST (OK / NOT OK / NA)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {CHECKLIST_ITEMS.map((item, index) => (
                <label
                  key={index}
                  className="flex items-center text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    name={`checklist_${item}`}
                    checked={formData.checklist?.includes(item)}
                    onChange={handleChecklistChange}
                    disabled={submitted}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">SERVICE RENDERED</h3>
            <div className="space-y-4">
              <FormInput
                label="Nature of Complaint"
                name="nature_of_complaint"
                value={formData.nature_of_complaint}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
              <FormInput
                label="Observation"
                name="observation"
                value={formData.observation}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
              <FormInput
                label="Action Taken"
                name="action_taken"
                value={formData.action_taken}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
            </div>
          </div>

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
                  {spareParts.map((part, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          name="replaced"
                          data-index={index}
                          value={part.replaced}
                          onChange={(e) => handleSparePartChange(index, e)}
                          readOnly={submitted}
                          className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          name="tobereplaced"
                          data-index={index}
                          value={part.tobereplaced}
                          onChange={(e) => handleSparePartChange(index, e)}
                          readOnly={submitted}
                          className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!submitted && (
              <button
                type="button"
                onClick={addSparePartRow}
                disabled={spareParts.length >= 5}
                className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:bg-gray-400"
              >
                Add Row
              </button>
            )}

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700">
                <strong>Please Rate the service:</strong>
              </label>
              <div className="mt-2 flex flex-wrap gap-4">
                {[
                  "extremelySatisfied",
                  "satisfied",
                  "dissatisfied",
                  "annoyed",
                ].map((rating) => (
                  <label
                    key={rating}
                    className="flex items-center text-sm text-gray-700 capitalize"
                  >
                    <input
                      type="radio"
                      name="serviceRating"
                      value={rating}
                      checked={formData.serviceRating === rating}
                      onChange={handleChange}
                      disabled={submitted}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    {rating.replace(/([A-Z])/g, " $1").trim()}
                  </label>
                ))}
              </div>
            </div>

            <FormInput
              label="Customer Feedback"
              name="customerFeedback"
              value={formData.customerFeedback}
              onChange={handleChange}
              readOnly={submitted}
              required
              className="mt-4"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Authorized Person (Engineer)
              </h3>
              {submitted && formData.authorized_person_sign ? (
                <img
                  src={formData.authorized_person_sign}
                  alt="Authorized Person Signature"
                  className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                />
              ) : (
                <div className="border border-gray-300 rounded-md mb-4 bg-gray-50 p-2 engineer-signature-placeholder">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Signature:
                  </label>
                  <canvas
                    ref={engineerCanvasRef}
                    width="400"
                    height="200"
                    className="w-full border border-gray-400 rounded-md bg-white cursor-crosshair"
                  />
                  <div className="mt-2 flex justify-end no-print">
                    <button
                      type="button"
                      onClick={() => clearSignature("engineer")}
                      className="text-sm text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              <FormInput
                label="Name"
                name="authorized_person_name"
                value={formData.authorized_person_name}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
              <FormInput
                label="Designation"
                name="authorized_person_designation"
                value={formData.authorized_person_designation}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
              <FormInput
                label="Mobile"
                name="authorized_person_mobile"
                value={formData.authorized_person_mobile}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Customer</h3>
              {submitted && formData.customer_sign ? (
                <img
                  src={formData.customer_sign}
                  alt="Customer Signature"
                  className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                />
              ) : (
                <div className="border border-gray-300 rounded-md mb-4 bg-gray-50 p-2 customer-signature-placeholder">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Signature:
                  </label>
                  <canvas
                    ref={customerCanvasRef}
                    width="400"
                    height="200"
                    className="w-full border border-gray-400 rounded-md bg-white cursor-crosshair"
                  />
                  <div className="mt-2 flex justify-end no-print">
                    <button
                      type="button"
                      onClick={() => clearSignature("customer")}
                      className="text-sm text-blue-600 hover:text-blue-800 transition duration-150 ease-in-out"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              <FormInput
                label="Name"
                name="customer_name1"
                value={formData.customer_name1}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
              <FormInput
                label="Designation"
                name="customer_designation"
                value={formData.customer_designation}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
              <FormInput
                label="Mobile"
                name="customer_mobile"
                value={formData.customer_mobile}
                onChange={handleChange}
                readOnly={submitted}
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8 no-print">
            {!submitted && (
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-semibold rounded-md shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
              >
                Submit Report
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
            >
              Print Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper component for consistent form inputs
const FormInput = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  readOnly = false,
  disabled = false,
  required = false,
  className = "",
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}:
      </label>
      <input
        id={name}
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        readOnly={readOnly}
        disabled={disabled}
        required={required}
        className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
};
