"use client";

import EmployeeLeadsTable from "./EmployeeLeadsTable";
import { useRouter, useSearchParams } from "next/navigation";

export default function MyLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaign = searchParams.get("campaign");

  const isSocialMedia = campaign === "social_media";

  const handleToggle = () => {
    if (isSocialMedia) {
      router.push("/user-dashboard/my-leads"); // Go back to normal leads
    } else {
      router.push("/user-dashboard/my-leads?campaign=social_media"); // Show social media leads
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-full mx-auto bg-white shadow-xl rounded-xl p-6 md:p-8">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
          <h2 className="text-3xl text-center sm:text-left text-gray-900">
            {isSocialMedia ? "Social Media Leads" : "My Assigned Leads"}
          </h2>
          <button
            onClick={handleToggle}
            className="mt-3 sm:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {isSocialMedia ? "Back to My Leads" : "Social Media Leads"}
          </button>
        </div>
        <EmployeeLeadsTable campaign={campaign} />
      </div>
    </div>
  );
}
