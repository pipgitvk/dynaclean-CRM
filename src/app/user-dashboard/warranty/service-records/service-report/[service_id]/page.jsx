// app/service-report/[service_id]/page.jsx
"use client"; // This makes it a Client Component

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast"; // For notifications

export default function ServiceReportPage() {
  const { service_id } = useParams();
  console.log("Service ID from params:", service_id);
  const router = useRouter();
  const [serviceData, setServiceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define your base URL using environment variable
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  useEffect(() => {
    async function fetchServiceRecord() {
      try {
        const response = await fetch(`/api/service-records/${service_id}`);
        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        setServiceData(data);
      } catch (err) {
        setError(err.message);
        toast.error(`Failed to load service report: ${err.message}`);
        console.error("Fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (service_id) {
      fetchServiceRecord();
    }
  }, [service_id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Loading service report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!serviceData) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Service report not found.</p>
      </div>
    );
  }

  // Destructure data for easier access and consistent naming
  const {
    warranty_info,
    warranty_expiry,
    service_id: currentServiceId, // Renaming to avoid conflict with params.service_id
    complaint_summary,
    attachments, // These are the damaged/installed product images
    installation_report: digitalReportFilename, // This is the installation report file name
    status,
    completed_date,
    completion_remark,
    assigned_to,
    service_type,
  } = serviceData;

  // Assuming `completion_images` is also stored in `attachments` or a similar field
  // and needs to be distinguished if service_type is not "INSTALLATION"
  // Based on your PHP, it looks like 'attachments' is for initial images,
  // and 'completion_images' (which you have in PHP as $attachments from the second query)
  // is for post-service images. Let's assume for now your Next.js API combined them,
  // or you'll need to adjust the API to return `completion_images` separately.
  // For now, I'll use `attachments` for initial images and make a note about `completion_images`.

  const initialImagePaths = attachments
    ? attachments.split(",").filter(Boolean)
    : [];
  // For completion images, if they are stored in a different field, retrieve them accordingly.
  // Assuming if `service_type` is not 'INSTALLATION', you show 'completion_images'.
  // Your API currently sends all image paths in `attachments`.
  // If `completion_images` are distinct and stored in a separate DB column in `service_records`,
  // you'd need to modify the API to fetch `completion_images` separately and include them in the response.
  // For this front-end, I'll assume `completion_images` would come as `serviceData.completion_images`.
  // If your `completion_images` are also in `attachments` but conditionally displayed,
  // you'll need a way to differentiate them, perhaps by path prefix or an additional field.
  // As per your PHP, `completion_images` seems to be distinct from the initial `attachments`.
  // Let's create a placeholder for `completionImages` if your API sends it.
  const completionImages = serviceData.completion_images
    ? serviceData.completion_images.split(",").filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-6 sm:p-8">
        <h2 className="text-3xl font-bold text-blue-700 mb-6 text-center border-b-2 pb-4 border-blue-200">
          Service Report
        </h2>

        {/* Customer & Product Information Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="info-box p-4 rounded-md">
            <h4 className="font-semibold text-lg text-blue-700 mb-3">
              Customer Information
            </h4>
            <p>
              <strong>Service ID:</strong> {currentServiceId}
            </p>
            <p>
              <strong>Customer Name:</strong> {warranty_info?.customer_name}
            </p>
            <p>
              <strong>Email:</strong> {warranty_info?.email}
            </p>
            <p>
              <strong>Contact:</strong> {warranty_info?.contact}
            </p>
            <p>
              <strong>Address:</strong> {warranty_info?.customer_address}
            </p>
            <p>
              <strong>Installed Address:</strong>{" "}
              {warranty_info?.installed_address}
            </p>
            <p>
              <strong>Invoice Number:</strong> {warranty_info?.invoice_number}
            </p>
          </div>
          <div className="info-box p-4 rounded-md">
            <h4 className="font-semibold text-lg text-blue-700 mb-3">
              Product & Warranty Info
            </h4>
            <p>
              <strong>Invoice Date:</strong> {warranty_info?.invoice_date}
            </p>
            <p>
              <strong>Product Name:</strong> {warranty_info?.product_name}
            </p>
            <p>
              <strong>Specification:</strong> {warranty_info?.specification}
            </p>
            <p>
              <strong>Serial No.:</strong> {warranty_info?.serial_number}
            </p>
            <p>
              <strong>Installation Date:</strong>{" "}
              {warranty_info?.installation_date}
            </p>
            <p>
              <strong>Warranty Period:</strong> {warranty_info?.warranty_period}{" "}
              months
            </p>
            <p>
              <strong>Warranty Expiry:</strong> {warranty_expiry}
            </p>
            <p>
              <strong>Model:</strong> {warranty_info?.model}
            </p>
          </div>
          <div className="col-span-full info-box bg-orange-50 p-4 rounded-md border border-orange-200">
            <h4 className="font-semibold text-lg text-orange-700 mb-3">
              Complaint Details
            </h4>
            <p>
              <strong>Complaint Date:</strong> {serviceData?.complaint_date}
            </p>
            <p>
              <strong>Complaint Summary:</strong> {complaint_summary}
            </p>
          </div>
        </div>

        {/* Damaged/Installed Product Images Display */}
        {initialImagePaths.length > 0 && (
          <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-white">
            <h5 className="font-semibold text-xl text-gray-800 mb-4">
              {service_type === "INSTALLATION"
                ? "Installed Product Images:"
                : "Damaged Product Images:"}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {initialImagePaths.map((imagePath, idx) => (
                <div
                  key={idx}
                  className="border border-gray-300 rounded-md overflow-hidden shadow-sm"
                >
                  <img
                    src={`${baseUrl}${imagePath}`}
                    alt={`${
                      service_type === "INSTALLATION" ? "Installed" : "Damaged"
                    } Product Image ${idx + 1}`}
                    className="w-full h-48 object-cover transition-transform duration-200 hover:scale-105"
                  />
                  <a
                    href={`${baseUrl}${imagePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-blue-600 hover:underline p-2 text-sm bg-gray-50 transition-colors duration-200 hover:bg-blue-100"
                  >
                    View Image {idx + 1}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Completion Records */}
        <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="font-bold text-2xl text-green-700 mb-4 text-center border-b-2 pb-2 border-green-200">
            Service Completion Records
          </h3>
          <div className="info-box p-4 rounded-md">
            <p>
              <strong>Service ID:</strong> {currentServiceId}
            </p>
            <p>
              <strong>Status:</strong> {status}
            </p>
            <p>
              <strong>Completed Date:</strong> {completed_date}
            </p>
            <p>
              <strong>Action Taken:</strong> {completion_remark}
            </p>
            <p>
              <strong>Completed by:</strong> {assigned_to}
            </p>
          </div>

          {/* Digital Report Download Button */}
          {digitalReportFilename && digitalReportFilename.trim() !== "" && (
            <div className="mt-4 text-center">
              <a
                href={`${baseUrl}/attachments/${digitalReportFilename}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Download Digital Report
              </a>
            </div>
          )}

          {/* Completion Images Display (Conditional) */}
          {service_type !== "INSTALLATION" && completionImages.length > 0 && (
            <div className="mt-8 p-4 border border-gray-200 rounded-lg bg-white">
              <h4 className="font-semibold text-xl text-gray-800 mb-4">
                Completion Images:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {completionImages.map((imageName, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-300 rounded-md overflow-hidden shadow-sm"
                  >
                    {/* Assuming completion_files is also under public/attachments or a similar public directory */}
                    <img
                      src={`${baseUrl}/attachments/${imageName}`}
                      alt={`Completion Image ${idx + 1}`}
                      className="w-full h-48 object-cover transition-transform duration-200 hover:scale-105"
                    />
                    <a
                      href={`${baseUrl}/attachments/${imageName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-blue-600 hover:underline p-2 text-sm bg-gray-50 transition-colors duration-200 hover:bg-blue-100"
                    >
                      View Image {idx + 1}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Print Preview and Back Button */}
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-md shadow-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
          >
            Print Preview
          </button>
          <Link
            href="/user-dashboard/warranty/products"
            className="text-blue-600 hover:underline text-lg font-medium"
          >
            &larr; Back to Service Reports
          </Link>
        </div>
      </div>
    </div>
  );
}
