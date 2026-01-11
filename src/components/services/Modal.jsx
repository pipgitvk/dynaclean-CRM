// components/Modal.jsx
"use client";
import React, { useEffect, useState } from "react";
import ServiceAttachmentLink from "./ServiceAttachmentLink";


export default function Modal({
  isOpen,
  onClose,
  title,
  selectedService,
  baseUrl,
}) {
  const [customerId, setCustomerId] = useState(null);
  const [loadingCustomerId, setLoadingCustomerId] = useState(false);

  // Fetch customer ID when modal opens
  useEffect(() => {
    const fetchCustomerId = async () => {
      if (!selectedService) return;
      
      setLoadingCustomerId(true);
      try {
        const response = await fetch('/api/customer-lookup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: selectedService.email,
            phone: selectedService.contact,
            company: selectedService.customer_name,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.customers && data.customers.length > 0) {
            // Use the first matching customer
            setCustomerId(data.customers[0].customer_id);
          } else {
            setCustomerId(null);
          }
        }
      } catch (error) {
        console.error('Error fetching customer ID:', error);
        setCustomerId(null);
      } finally {
        setLoadingCustomerId(false);
      }
    };

    if (isOpen && selectedService) {
      fetchCustomerId();
    }
  }, [isOpen, selectedService]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Early return after all hooks
  if (!isOpen || !selectedService) return null;

  console.log("Selected Service in Modal:", selectedService);

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-opacity-30 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 text-2xl font-bold leading-none"
            >
              &times;
            </button>
          </div>
        </div>
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          <div className="space-y-3 text-gray-700 text-sm">
            <p>
              <strong>Service Type:</strong> {selectedService.service_type}
            </p>
            <p>
              <strong>Customer ID:</strong>{" "}
              {loadingCustomerId ? (
                <span className="text-gray-500">Loading...</span>
              ) : customerId ? (
                <span className="text-blue-600 font-semibold">{customerId}</span>
              ) : (
                <span className="text-gray-400">Not Found</span>
              )}
            </p>
            <p>
              <strong>Customer Name</strong> {selectedService.customer_name}
            </p>
            <p>
              <strong>Contact</strong> {selectedService.contact}
            </p>
            <p>
              <strong>Email</strong> {selectedService.email}
            </p>
            <p>
              <strong>Complaint Date:</strong>{" "}
              {selectedService.complaint_date instanceof Date
                ? selectedService.complaint_date.toDateString()
                : selectedService.complaint_date}
            </p>
            <p>
              <strong>Complaint Summary:</strong>{" "}
              {selectedService.complaint_summary}
            </p>
            <p>
              <strong>Assigned To:</strong>{" "}
              {selectedService.assigned_to || "Not Assigned"}
            </p>
            <p>
              <strong>Installation Address:</strong>{" "}
              {selectedService.installed_address}
            </p>
            <p>
              <strong>Invoice Date:</strong>{" "}
              {new Date(selectedService.invoice_date).toLocaleDateString()}
            </p>

            <p>
              <strong>Product Name:</strong> {selectedService.product_name}
            </p>
            <p>
              <strong>Specification:</strong> {selectedService.specification}
            </p>
            <p>
              <strong>Model:</strong> {selectedService.model}
            </p>
            <p>
              <strong>Company Name:</strong> {selectedService.customer_name}
            </p>

            <p>
              <strong>Parts Replaced:</strong> {selectedService.parts_replaced}
            </p>

            <p>
              <strong>Status:</strong>
              <span
                className={`font-semibold ${
                  selectedService.status?.toUpperCase() === "COMPLETED"
                    ? "text-green-600"
                    : selectedService.status?.toUpperCase() ===
                      "PENDING FOR SPARES"
                    ? "text-orange-600"
                    : "text-blue-600"
                }`}
              >
                {selectedService.status}
              </span>
            </p>
            {/* Service Report Link */}
            <p>
              <strong>Service Report:</strong>{" "}
              <a
                href={`/user-dashboard/view-service-report/${selectedService.service_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                View Service Report
              </a>
            </p>
            <p>
              <strong>Completed Date:</strong>{" "}
              {selectedService.completed_date instanceof Date
                ? selectedService.completed_date.toDateString()
                : selectedService.completed_date}
            </p>
            <p>
              <strong>Company Cost:</strong>{" "}
              {selectedService.company_cost || "N/A"}
            </p>

            {selectedService.attachments && (
              <div>
                <strong>Attachments:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  {selectedService.attachments
                    .split(",")
                    .filter(Boolean)
                    .map((file, index) => {
                      const trimmedFile = file.trim();
                      console.log('[Modal] Processing attachment:', index, trimmedFile);
                      return (
                        <li key={index}>
                          <ServiceAttachmentLink
                            filePath={trimmedFile}
                            fileName={trimmedFile.split('/').pop()}
                            className="text-blue-600 hover:underline"
                          />
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
            {selectedService.installation_report &&
              selectedService.installation_report !== "uploadFO" && (
                <p>
                  <strong>Installation Report:</strong>{" "}
                  {selectedService.installation_report.includes(',')
                    ? selectedService.installation_report.split(',').filter(Boolean).map((file, index) => (
                        <span key={index}>
                          <ServiceAttachmentLink
                            filePath={file.trim()}
                            fileName={file.split('/').pop()}
                            className="text-blue-600 hover:underline"
                          />
                          {index < selectedService.installation_report.split(',').filter(Boolean).length - 1 && ', '}
                        </span>
                      ))
                    : (
                      <ServiceAttachmentLink
                        filePath={selectedService.installation_report.trim()}
                        fileName={selectedService.installation_report.split('/').pop()}
                        className="text-blue-600 hover:underline"
                      />
                    )}
                </p>
              )}

            {selectedService.pre_completion && (
              <p>
                <strong>Pre Completion:</strong>{" "}
                {selectedService.pre_completion.includes(',')
                  ? selectedService.pre_completion.split(',').filter(Boolean).map((file, index) => (
                      <span key={index}>
                        <ServiceAttachmentLink
                          filePath={file.trim()}
                          fileName={file.split('/').pop()}
                          className="text-blue-600 hover:underline"
                        />
                        {index < selectedService.pre_completion.split(',').filter(Boolean).length - 1 && ', '}
                      </span>
                    ))
                  : (
                    <ServiceAttachmentLink
                      filePath={selectedService.pre_completion.trim()}
                      fileName={selectedService.pre_completion.split('/').pop()}
                      className="text-blue-600 hover:underline"
                    />
                  )}
              </p>
            )}
            {selectedService.after_completion && (
              <p>
                <strong>After Completion:</strong>{" "}
                {selectedService.after_completion.includes(',')
                  ? selectedService.after_completion.split(',').filter(Boolean).map((file, index) => (
                      <span key={index}>
                        <ServiceAttachmentLink
                          filePath={file.trim()}
                          fileName={file.split('/').pop()}
                          className="text-blue-600 hover:underline"
                        />
                        {index < selectedService.after_completion.split(',').filter(Boolean).length - 1 && ', '}
                      </span>
                    ))
                  : (
                    <ServiceAttachmentLink
                      filePath={selectedService.after_completion.trim()}
                      fileName={selectedService.after_completion.split('/').pop()}
                      className="text-blue-600 hover:underline"
                    />
                  )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
