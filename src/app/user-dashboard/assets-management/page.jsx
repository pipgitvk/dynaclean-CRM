"use client";

import { useState } from "react";
import AssetFormPage from "@/components/assets/addAssets";
import AssetsTable from "@/components/assets/AssetsTable";
import Link from "next/link";

export default function Assets() {
  const [showForm, setShowForm] = useState(false);

  const handleToggle = () => {
    setShowForm((prev) => !prev);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="p-6 bg-white rounded-xl shadow-md space-y-4">
          <h1 className="text-2xl font-semibold text-gray-700 tracking-tight">
            Assets Management
          </h1>
          <div className="flex flex-wrap space-x-2 gap-2 sm:space-x-4 sm:gap-4">
            <button
              onClick={handleToggle}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition w-full sm:w-auto"
            >
              {showForm ? "Hide Form" : "+ Add New Asset"}
            </button>

            <Link
              href="/user-dashboard/assets-management/assignments"
              className="px-6 py-3 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-full sm:w-auto"
            >
              Assets Transactions
            </Link>
          </div>

          {showForm && <AssetFormPage />}
        </div>
      </div>

      <AssetsTable />
    </>
  );
}
