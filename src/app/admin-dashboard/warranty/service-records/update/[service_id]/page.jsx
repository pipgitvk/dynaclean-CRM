// app/service/[service_id]/page.jsx
"use client"; // This makes it a Client Component

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form"; // For easier form handling and validation
import toast from "react-hot-toast"; // For better success/error messages

export default function UpdateServiceRecordPage({ params }) {
  const { service_id } = params;
  const router = useRouter();
  const [serviceData, setServiceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize react-hook-form
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm();

  // Define your base URL using environment variable (NEXT_PUBLIC_BASE_URL)
  // This is crucial for correctly linking to static assets like images and PDFs.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ""; // Fallback to empty string if not set

  useEffect(() => {
    async function fetchServiceRecord() {
      try {
        const response = await fetch(`/api/service-records/${service_id}`);
        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        setServiceData(data);
        // Set form default values using `reset` from react-hook-form
        // This ensures the form is pre-filled with existing data
        reset({
          observation: data.observation || "",
          action_taken: data.action_taken || "",
          parts_replaced: data.parts_replaced || "",
          service_description: data.service_description || "",
          status: data.status || "PENDING",
        });
      } catch (err) {
        setError(err.message);
        toast.error(`Failed to load service record: ${err.message}`);
        console.error("Fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (service_id) {
      fetchServiceRecord();
    }
  }, [service_id, reset]); // `reset` is a stable function, so it's fine as a dependency

  const onSubmit = async (data) => {
    try {
      // Create FormData object for file uploads and other form fields
      const formData = new FormData();
      formData.append("observation", data.observation);
      formData.append("action_taken", data.action_taken);
      formData.append("parts_replaced", data.parts_replaced);
      formData.append("service_description", data.service_description);
      formData.append("status", data.status);

      // Append installation file if selected by the user
      if (data.installationFile && data.installationFile.length > 0) {
        formData.append("installationFile", data.installationFile[0]);
      }
      // Append multiple service images if selected by the user
      if (data.service_images && data.service_images.length > 0) {
        for (let i = 0; i < data.service_images.length; i++) {
          formData.append("service_images", data.service_images[i]);
        }
      }

      // Send the data to your API route
      const response = await fetch(`/api/service-records/${service_id}`, {
        method: "POST",
        body: formData, // FormData automatically sets the correct 'Content-Type: multipart/form-data' header
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.statusText}`);
      }

      toast.success("Service record updated successfully!");
      router.push("/user-dashboard/warranty/products"); // Redirect to the service reports list page
    } catch (err) {
      toast.error(`Failed to update service record: ${err.message}`);
      console.error("Error updating service record:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Loading service record...</p>
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

  // If serviceData is null after loading (e.g., 404 from API)
  if (!serviceData) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Service record not found.</p>
      </div>
    );
  }

  // Destructure service data for easier access
  const { warranty_info, warranty_expiry } = serviceData;
  const imagePaths = serviceData.attachments
    ? serviceData.attachments.split(",").filter(Boolean)
    : [];
  // installation_report from DB is just the filename, so we check if it's non-empty
  const installationReportPresent =
    serviceData.installation_report &&
    serviceData.installation_report.trim() !== "";

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-6 sm:p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Update Service Record
        </h2>

        {/* Customer & Product Information Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="info-box p-4 rounded-md">
            <h4 className="font-semibold text-lg text-blue-700 mb-3">
              Customer Information
            </h4>
            <p>
              <strong>Service ID:</strong> {serviceData.service_id}
            </p>
            <p>
              <strong>Customer Name:</strong> {warranty_info.customer_name}
            </p>
            <p>
              <strong>Email:</strong> {warranty_info.email}
            </p>
            <p>
              <strong>Contact:</strong> {warranty_info.contact}
            </p>
            <p>
              <strong>Address:</strong> {warranty_info.customer_address}
            </p>
            <p>
              <strong>Installed Address:</strong>{" "}
              {warranty_info.installed_address}
            </p>
            <p>
              <strong>Invoice Number:</strong> {warranty_info.invoice_number}
            </p>
            <p>
              <strong>Invoice Date:</strong> {warranty_info.invoice_date}
            </p>
          </div>
          <div className="info-box p-4 rounded-md">
            <h4 className="font-semibold text-lg text-blue-700 mb-3">
              Product & Warranty Info
            </h4>
            <p>
              <strong>Product Name:</strong> {warranty_info.product_name}
            </p>
            <p>
              <strong>Specification:</strong> {warranty_info.specification}
            </p>
            <p>
              <strong>Serial No.:</strong> {warranty_info.serial_number}
            </p>
            <p>
              <strong>Installation Date:</strong>{" "}
              {warranty_info.installation_date}
            </p>
            <p>
              <strong>Warranty Period:</strong> {warranty_info.warranty_period}{" "}
              months
            </p>
            <p>
              <strong>Warranty Expiry:</strong> {warranty_expiry}
            </p>
            <p>
              <strong>Model:</strong> {warranty_info.model}
            </p>
          </div>
          <div className="col-span-full info-box bg-orange-50 p-4 rounded-md border border-orange-200">
            <h4 className="font-semibold text-lg text-orange-700 mb-3">
              Complaint Details
            </h4>
            <p>
              <strong>Complaint Date:</strong> {serviceData.complaint_date}
            </p>
            <p>
              <strong>Complaint Summary:</strong>{" "}
              {serviceData.complaint_summary}
            </p>
          </div>
        </div>

        {/* Damaged Product Images Display */}
        {imagePaths.length > 0 && (
          <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-white">
            <h5 className="font-semibold text-xl text-gray-800 mb-4">
              Damaged Product Images:
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {imagePaths.map((imagePath, idx) => (
                <div
                  key={idx}
                  className="border border-gray-300 rounded-md overflow-hidden shadow-sm"
                >
                  <img
                    src={`${baseUrl}${imagePath}`} // Use absolute URL
                    alt={`Damaged Product Image ${idx + 1}`}
                    className="w-full h-48 object-cover transition-transform duration-200 hover:scale-105"
                  />
                  <a
                    href={`${baseUrl}${imagePath}`} // Use absolute URL for direct link
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

        {/* Update Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Upload Damaged Product Images (only if none exist already) */}
          {imagePaths.length === 0 && (
            <div>
              <label
                htmlFor="service_images"
                className="block text-lg font-medium text-gray-700 mb-2"
              >
                Upload Damaged Product Images:
              </label>
              <input
                type="file"
                id="service_images"
                multiple
                accept="image/*" // Restrict to image files
                {...register("service_images")} // Register with react-hook-form
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {errors.service_images && (
                <span className="text-red-500 text-sm">
                  {errors.service_images.message}
                </span>
              )}
            </div>
          )}

          {/* Installation Report Section */}
          {installationReportPresent ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
              <span className="text-lg font-medium text-gray-700">
                Existing Service Report:
              </span>
              <a
                // Construct the full URL for the installation report
                href={`${baseUrl}/attachments/${serviceData.installation_report}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Download Service Report
              </a>
            </div>
          ) : (
            <div>
              <label
                htmlFor="installationFile"
                className="block text-lg font-medium text-gray-700 mb-2"
              >
                Upload Service Report:
              </label>
              <input
                type="file"
                id="installationFile"
                accept=".pdf,.doc,.docx,.xls,.xlsx" // Restrict to document files
                {...register("installationFile")} // Register with react-hook-form
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {errors.installationFile && (
                <span className="text-red-500 text-sm">
                  {errors.installationFile.message}
                </span>
              )}
            </div>
          )}

          {/* Observation */}
          <div>
            <label
              htmlFor="observation"
              className="block text-lg font-medium text-gray-700 mb-2"
            >
              Observation:
            </label>
            <textarea
              id="observation"
              rows="4"
              {...register("observation", {
                required: "Observation is required.",
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900 resize-y"
            ></textarea>
            {errors.observation && (
              <span className="text-red-500 text-sm">
                {errors.observation.message}
              </span>
            )}
          </div>

          {/* Action Taken */}
          <div>
            <label
              htmlFor="action_taken"
              className="block text-lg font-medium text-gray-700 mb-2"
            >
              Action Taken:
            </label>
            <textarea
              id="action_taken"
              rows="4"
              {...register("action_taken", {
                required: "Action Taken is required.",
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900 resize-y"
            ></textarea>
            {errors.action_taken && (
              <span className="text-red-500 text-sm">
                {errors.action_taken.message}
              </span>
            )}
          </div>

          {/* Parts Replaced */}
          <div>
            <label
              htmlFor="parts_replaced"
              className="block text-lg font-medium text-gray-700 mb-2"
            >
              Parts Replaced:
            </label>
            <textarea
              id="parts_replaced"
              rows="4"
              {...register("parts_replaced", {
                required: "Parts Replaced is required.",
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900 resize-y"
            ></textarea>
            {errors.parts_replaced && (
              <span className="text-red-500 text-sm">
                {errors.parts_replaced.message}
              </span>
            )}
          </div>

          {/* Service Description */}
          <div>
            <label
              htmlFor="service_description"
              className="block text-lg font-medium text-gray-700 mb-2"
            >
              Service Description:
            </label>
            <textarea
              id="service_description"
              rows="4"
              {...register("service_description", {
                required: "Service Description is required.",
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900 resize-y"
            ></textarea>
            {errors.service_description && (
              <span className="text-red-500 text-sm">
                {errors.service_description.message}
              </span>
            )}
          </div>

          {/* Status Dropdown */}
          <div>
            <label
              htmlFor="status"
              className="block text-lg font-medium text-gray-700 mb-2"
            >
              Status:
            </label>
            <select
              id="status"
              {...register("status", { required: "Status is required." })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white text-gray-900"
            >
              <option value="PENDING">PENDING</option>
              <option value="PENDING FOR SPARES">PENDING FOR SPARES</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
            {errors.status && (
              <span className="text-red-500 text-sm">
                {errors.status.message}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting} // Disable button while submission is in progress
            className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isSubmitting ? "Updating..." : "Update Service Record"}
          </button>
        </form>

        {/* Back Button */}
        <div className="mt-8 text-center">
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
