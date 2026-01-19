// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { useForm } from "react-hook-form";
// import toast from "react-hot-toast";
// import Link from "next/link";

// export default function EditWarrantyClient({ serialNumber }) {
//   const router = useRouter();

//   const [productData, setProductData] = useState(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState(null);

//   const {
//     register,
//     handleSubmit,
//     reset,
//     formState: { isSubmitting, errors },
//   } = useForm();

//   useEffect(() => {
//     if (!serialNumber) return;

//     async function fetchProductData() {
//       try {
//         const res = await fetch(`/api/warranty-products/${serialNumber}`);
//         if (!res.ok) throw new Error("Failed to fetch");
//         const data = await res.json();
//         setProductData(data);
//         reset(data);
//       } catch (err) {
//         setError(err.message);
//         toast.error(err.message);
//       } finally {
//         setIsLoading(false);
//       }
//     }

//     fetchProductData();
//   }, [serialNumber, reset]);

//   const onSubmit = async (data) => {
//     try {
//       const res = await fetch(`/api/warranty-products/${serialNumber}`, {
//         method: "PUT",
//         body: JSON.stringify(data),
//       });

//       if (!res.ok) throw new Error("Update failed");

//       toast.success("Warranty updated");
//       router.push("/user-dashboard/warranty/products");
//     } catch (err) {
//       toast.error(err.message);
//     }
//   };

//   if (isLoading) return <p>Loading...</p>;
//   if (error) return <p className="text-red-600">{error}</p>;

//   return (
//     <form onSubmit={handleSubmit(onSubmit)}>
//       <input {...register("product_name")} />
//       <button type="submit" disabled={isSubmitting}>
//         Update
//       </button>

//       <button type="button" onClick={() => router.back()}>
//         Back
//       </button>
//     </form>
//   );
// }

// app/warranty/[serial_number]/page.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

const STATES = [
  "Andhra Pradesh (28)",
  "Arunachal Pradesh (12)",
  "Assam (18)",
  "Bihar (10)",
  "Chhattisgarh (22)",
  "Goa (30)",
  "Gujarat (24)",
  "Haryana (06)",
  "Himachal Pradesh (02)",
  "Jharkhand (20)",
  "Karnataka (29)",
  "Kerala (32)",
  "Madhya Pradesh (23)",
  "Maharashtra (27)",
  "Manipur (14)",
  "Meghalaya (17)",
  "Mizoram (15)",
  "Nagaland (13)",
  "Odisha (21)",
  "Punjab (03)",
  "Rajasthan (08)",
  "Sikkim (11)",
  "Tamil Nadu (33)",
  "Telangana (36)",
  "Tripura (16)",
  "Uttar Pradesh (09)",
  "Uttarakhand (05)",
  "West Bengal (19)",
  "Delhi (07)",
  "Jammu and Kashmir (01)",
  "Ladakh (38)",
];

export default function EditWarrantyPage({ serial_number }) {
  const router = useRouter();
  //   const { serial_number } =  params;
  const initialSerialNumber = serial_number; // Serial number from URL
  // console.log("serial number is here", initialSerialNumber);
  const [productData, setProductData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm();

  // Base URL for linking to uploaded files
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  // Effect to fetch data when the serial_number in the URL changes
  useEffect(() => {
    async function fetchProductData() {
      if (!initialSerialNumber) {
        setIsLoading(false);
        setError("Serial number is missing from the URL.");
        return;
      }
      console.log("serial number is here", initialSerialNumber);
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/warranty-products/${initialSerialNumber}`,
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Error: ${response.statusText}`);
        }
        const data = await response.json();
        setProductData(data);
        // Reset form with fetched data
        reset({
          product_name: data.product_name || "",
          specification: data.specification || "",
          model: data.model || "",
          serial_number: data.serial_number || "", // Pre-fill with existing serial number
          warranty_period: data.warranty_period || "",
          quantity: data.quantity || "",
          customer_name: data.customer_name || "",
          email: data.email || "",
          contact_person: data.contact_person || "",
          contact: data.contact || "",
          customer_address: data.customer_address || "",
          state: data.state || "",
          installed_address: data.installed_address || "",
          // Format dates to YYYY-MM-DD for input type="date"
          installation_date: data.installation_date
            ? new Date(data.installation_date).toISOString().split("T")[0]
            : "",
          invoice_number: data.invoice_number || "",
          invoice_date: data.invoice_date
            ? new Date(data.invoice_date).toISOString().split("T")[0]
            : "",
          site_person: data.site_person || "",
          site_email: data.site_email || "",
          lat: data.lat || "",
          longt: data.longt || "", // Ensure 'longt' matches DB field
          site_contact: data.site_contact || "",
          gstin: data.gstin || "",
          // No need to reset file inputs, they are handled separately
        });
      } catch (err) {
        setError(err.message);
        toast.error(`Failed to load product: ${err.message}`);
        console.error("Fetch error:", err);
        setProductData(null); // Clear data on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchProductData();
  }, [initialSerialNumber, reset]);

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      // Append all form fields
      for (const key in data) {
        if (key !== "invoice_file" && key !== "service_reports") {
          formData.append(key, data[key]);
        }
      }

      // Append invoice file if selected
      if (data.invoice_file && data.invoice_file.length > 0) {
        formData.append("invoice_file", data.invoice_file[0]);
      }

      // Append service reports if selected
      if (data.service_reports && data.service_reports.length > 0) {
        for (let i = 0; i < data.service_reports.length; i++) {
          formData.append("service_reports", data.service_reports[i]);
        }
      }

      const response = await fetch(
        `/api/warranty-products/${initialSerialNumber}`,
        {
          method: "PUT",
          body: formData,
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.statusText}`);
      }

      toast.success("Product warranty updated successfully!");

      router.push(`/user-dashboard/warranty/products`);

      router.refresh(); // This will re-run the useEffect for the current page
    } catch (err) {
      toast.error(`Failed to update product warranty: ${err.message}`);
      console.error("Error updating product warranty:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Loading product data...</p>
      </div>
    );
  }

  if (error && !productData) {
    // Only show global error if no data could be loaded
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-100 p-4">
        <p className="text-xl text-red-600 text-center mb-4">Error: {error}</p>
        <p className="text-md text-gray-700 text-center">
          Please ensure a valid serial number is provided in the URL (e.g.,
          `/warranty/YOUR_SERIAL_NUMBER`).
        </p>
        <Link
          href="/view_warranty"
          className="mt-6 text-blue-600 hover:underline text-lg font-medium"
        >
          &larr; Back to Warranty List
        </Link>
      </div>
    );
  }

  const invoiceFileLink = productData?.invoice_file
    ? `${baseUrl}/uploads/${productData.invoice_file}`
    : null;
  const serviceReportLinks = productData?.report_file
    ? productData.report_file
        .split(",")
        .filter(Boolean)
        .map((filename) => `${baseUrl}/uploads/${filename}`)
    : [];

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-6 sm:p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Product Warranty Edit
        </h2>

        {productData && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Product Information */}
            <h3 className="text-2xl font-semibold text-gray-700 border-b pb-2 mb-4">
              Product Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="product_name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Product Name:
                </label>
                <input
                  type="text"
                  id="product_name"
                  {...register("product_name", {
                    required: "Product Name is required",
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.product_name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.product_name.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="model"
                  className="block text-sm font-medium text-gray-700"
                >
                  Model:
                </label>
                <input
                  type="text"
                  id="model"
                  {...register("model")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
              </div>
              <div>
                <label
                  htmlFor="serial_number"
                  className="block text-sm font-medium text-gray-700"
                >
                  Serial Number:
                </label>
                <input
                  type="text"
                  id="serial_number"
                  {...register("serial_number", {
                    required: "Serial Number is required",
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.serial_number && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.serial_number.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="quantity"
                  className="block text-sm font-medium text-gray-700"
                >
                  Quantity:
                </label>
                <input
                  type="number"
                  id="quantity"
                  {...register("quantity", {
                    required: "Quantity is required",
                    min: 1,
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.quantity && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.quantity.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="warranty_period"
                  className="block text-sm font-medium text-gray-700"
                >
                  Warranty Period (months):
                </label>
                <input
                  type="number"
                  id="warranty_period"
                  {...register("warranty_period", {
                    required: "Warranty Period is required",
                    min: 0,
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.warranty_period && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.warranty_period.message}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="specification"
                  className="block text-sm font-medium text-gray-700"
                >
                  Specification:
                </label>
                <textarea
                  id="specification"
                  rows="3"
                  {...register("specification")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900 resize-y"
                ></textarea>
              </div>
            </div>

            {/* Customer Information */}
            <h3 className="text-2xl font-semibold text-gray-700 border-b pb-2 mb-4 mt-8">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="customer_name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Customer/Company Name:
                </label>
                <input
                  type="text"
                  id="customer_name"
                  {...register("customer_name", {
                    required: "Customer Name is required",
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.customer_name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.customer_name.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Company Email:
                </label>
                <input
                  type="email"
                  id="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: "Invalid email address",
                    },
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="contact_person"
                  className="block text-sm font-medium text-gray-700"
                >
                  Company Contact Person:
                </label>
                <input
                  type="text"
                  id="contact_person"
                  {...register("contact_person", {
                    required: "Contact Person is required",
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.contact_person && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.contact_person.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="contact"
                  className="block text-sm font-medium text-gray-700"
                >
                  Compnay Contact Number:
                </label>
                <input
                  type="text"
                  id="contact"
                  {...register("contact", {
                    required: "Contact Number is required",
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.contact && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.contact.message}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="customer_address"
                  className="block text-sm font-medium text-gray-700"
                >
                  Customer Address:
                </label>
                <textarea
                  id="customer_address"
                  rows="3"
                  {...register("customer_address")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900 resize-y"
                ></textarea>
              </div>
              <div>
                <label
                  htmlFor="state"
                  className="block text-sm font-medium text-gray-700"
                >
                  State:
                </label>
                <select
                  id="state"
                  {...register("state")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                >
                  <option value="">Select State</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Site Information */}
            <h3 className="text-2xl font-semibold text-gray-700 border-b pb-2 mb-4 mt-8">
              Site Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="site_person"
                  className="block text-sm font-medium text-gray-700"
                >
                  Site Person:
                </label>
                <input
                  type="text"
                  id="site_person"
                  {...register("site_person")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
              </div>
              <div>
                <label
                  htmlFor="site_contact"
                  className="block text-sm font-medium text-gray-700"
                >
                  Site Person Contact:
                </label>
                <input
                  type="text"
                  id="site_contact"
                  {...register("site_contact")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
              </div>
              <div>
                <label
                  htmlFor="site_email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Site Person Email:
                </label>
                <input
                  type="email"
                  id="site_email"
                  {...register("site_email", {
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: "Invalid email address",
                    },
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.site_email && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.site_email.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="gstin"
                  className="block text-sm font-medium text-gray-700"
                >
                  GST Number:
                </label>
                <input
                  type="text"
                  id="gstin"
                  {...register("gstin")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
              </div>
              <div>
                <label
                  htmlFor="lat"
                  className="block text-sm font-medium text-gray-700"
                >
                  Location Latitude:
                </label>
                <input
                  type="text"
                  id="lat"
                  {...register("lat")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
              </div>
              <div>
                <label
                  htmlFor="longt"
                  className="block text-sm font-medium text-gray-700"
                >
                  Location Longitude:
                </label>
                <input
                  type="text"
                  id="longt" // Matched to 'longt' for consistency with DB and API
                  {...register("longt")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="installed_address"
                  className="block text-sm font-medium text-gray-700"
                >
                  Installed Address:
                </label>
                <textarea
                  id="installed_address"
                  rows="3"
                  {...register("installed_address")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900 resize-y"
                ></textarea>
              </div>
            </div>

            {/* Invoice Information */}
            <h3 className="text-2xl font-semibold text-gray-700 border-b pb-2 mb-4 mt-8">
              Invoice Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="invoice_number"
                  className="block text-sm font-medium text-gray-700"
                >
                  Invoice Number:
                </label>
                <input
                  type="text"
                  id="invoice_number"
                  {...register("invoice_number", {
                    required: "Invoice Number is required",
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.invoice_number && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.invoice_number.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="invoice_date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Invoice Date:
                </label>
                <input
                  type="date"
                  id="invoice_date"
                  {...register("invoice_date", {
                    required: "Invoice Date is required",
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.invoice_date && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.invoice_date.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="installation_date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Installation Date:
                </label>
                <input
                  type="date"
                  id="installation_date"
                  {...register("installation_date")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-gray-900"
                />
                {errors.installation_date && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.installation_date.message}
                  </p>
                )}
              </div>
            </div>

            {/* File Uploads */}
            <h3 className="text-2xl font-semibold text-gray-700 border-b pb-2 mb-4 mt-8">
              Attached Files
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Invoice File */}
              <div>
                <label
                  htmlFor="invoice_file"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Upload New Invoice File (PDF, Image):
                </label>
                <input
                  type="file"
                  id="invoice_file"
                  accept=".pdf,image/*"
                  {...register("invoice_file")}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {invoiceFileLink && (
                  <p className="mt-2 text-sm text-gray-600">
                    Existing Invoice:{" "}
                    <a
                      href={invoiceFileLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Current Invoice
                    </a>
                  </p>
                )}
              </div>

              {/* Service Reports */}
              <div>
                <label
                  htmlFor="service_reports"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Upload New Service Reports (Multiple Files):
                </label>
                <input
                  type="file"
                  id="service_reports"
                  multiple
                  accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                  {...register("service_reports")}
                  className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {serviceReportLinks.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">
                      Existing Reports:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {serviceReportLinks.map((link, index) => (
                        <li key={index}>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Report {index + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 text-center">
              <button
                type="submit"
                disabled={isSubmitting}
                className=" cursor-pointer w-full sm:w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isSubmitting ? "Updating..." : "Update Product Warranty"}
              </button>
            </div>
          </form>
        )}

        {/* Back button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline text-lg font-medium cursor-pointer"
          >
            &larr; Back
          </button>
        </div>
      </div>
    </div>
  );
}
