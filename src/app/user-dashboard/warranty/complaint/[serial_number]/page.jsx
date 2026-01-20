// app/user-dashboard/warranty/complaint/[serial_number]/page.jsx
"use client"; // This is a Client Component

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast, Toaster } from "react-hot-toast"; // For sleek notifications

export default function AddComplaintPage({ params }) {
  const router = useRouter();
  // const params = useParams<{ appointmentId: string }>();
  // const appointmentId = params?.appointmentId;
  const { serial_number } = useParams();

  const serialNumberFromParams = serial_number; // Get serial_number directly from params

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue, // Add setValue to programmatically set form values
  } = useForm({
    defaultValues: {
      serial_number: serialNumberFromParams, // Use the serial number from params
      service_type: "COMPLAINT",
      complaint_date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
      complaint_summary: "",
      status: "PENDING",
      assigned_to: "",
      attachments: null,
    },
  });

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  // Removed productDetails state as it's no longer fetched on the frontend for this page
  // const [productDetails, setProductDetails] = useState(null);
  // const [loadingProductDetails, setLoadingProductDetails] = useState(true); // No longer needed

  useEffect(() => {
    // Set the serial_number in the form once the component mounts and params are available
    if (serialNumberFromParams) {
      setValue("serial_number", serialNumberFromParams);
    }

    async function fetchUsers() {
      // Renamed to accurately reflect its sole purpose
      // Fetch users
      try {
        const usersResponse = await fetch("/api/complaints"); // GET request to fetch users
        if (!usersResponse.ok) {
          throw new Error("Failed to fetch users");
        }
        const usersData = await usersResponse.json();
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load assigned users.");
      } finally {
        setLoadingUsers(false);
      }
    }

    fetchUsers(); // Only call fetchUsers now
  }, [serialNumberFromParams, setValue]); // Re-run if serialNumberFromParams changes

  const onSubmit = async (data) => {
    const formData = new FormData();
    for (const key in data) {
      if (key === "attachments" && data[key] && data[key].length > 0) {
        for (let i = 0; i < data[key].length; i++) {
          formData.append("attachments", data[key][i]);
        }
      } else {
        formData.append(key, data[key]);
      }
    }

    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("Complaint added successfully!");
        reset(); // Reset form fields
        // Optionally redirect after a short delay
        setTimeout(() => {
          router.push("/user-dashboard/warranty/products"); // Adjust this path if your reports page is different
        }, 1500);
      } else {
        const errorData = await response.json();
        toast.error(`Error: ${errorData.error || "Failed to add complaint."}`);
        console.error("API Error:", errorData);
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-lightBlue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-8">
            ADD NEW COMPLAINT
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...register("serial_number")} />
            <input type="hidden" {...register("status")} />

            <div>
              <label
                htmlFor="service_type"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Service Type:
              </label>
              <select
                id="service_type"
                {...register("service_type")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="COMPLAINT">COMPLAINT</option>
                <option value="PREVENTIVE MAINTENANCE">
                  PREVENTIVE MAINTENANCE
                </option>
                <option value="TRAINING">TRAINING</option>
              </select>
              {errors.service_type && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.service_type.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="complaint_date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Complaint Date:
              </label>
              <input
                type="date"
                id="complaint_date"
                {...register("complaint_date", {
                  required: "Complaint Date is required",
                })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {errors.complaint_date && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.complaint_date.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="complaint_summary"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Customer Complaint Summary:
              </label>
              <textarea
                id="complaint_summary"
                rows={4}
                {...register("complaint_summary", {
                  required: "Complaint summary is required",
                })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-y"
              ></textarea>
              {errors.complaint_summary && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.complaint_summary.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="assigned_to"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Assign to User:
              </label>
              <select
                id="assigned_to"
                {...register("assigned_to", {
                  required: "Please assign to a user",
                })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={loadingUsers}
              >
                {loadingUsers ? (
                  <option value="">Loading users...</option>
                ) : (
                  <>
                    <option value="">Select a user</option>
                    {users.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {errors.assigned_to && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.assigned_to.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="attachments"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Attach images (Optional):
              </label>
              <input
                type="file"
                id="attachments"
                {...register("attachments")}
                multiple
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Submit Complaint
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
