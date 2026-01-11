// components/GoodFollowupsTable.jsx
import dayjs from "dayjs";
import { Search } from "lucide-react";
import { useState, useEffect } from "react";

const SkeletonRows = () => (
  <>
    {[...Array(3)].map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-8"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-28"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </td>
      </tr>
    ))}
  </>
);

export default function GoodFollowupsTable({ data, isLoading }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredData, setFilteredData] = useState([]);
  const [stageFilter, setStageFilter] = useState("");

  const stages = Array.from(
    new Set(data?.map((item) => item.stage).filter(Boolean))
  );

  useEffect(() => {
    if (!data) return;
    const lowercasedQuery = searchQuery.toLowerCase();

    const result = data.filter((item) => {
      const matchesSearch = Object.values(item).some(
        (value) =>
          value && value.toString().toLowerCase().includes(lowercasedQuery)
      );

      const matchesStage =
        stageFilter === "" || item.stage?.toLowerCase() === stageFilter.toLowerCase();

      return matchesSearch && matchesStage;
    });

    setFilteredData(result);
  }, [searchQuery, stageFilter, data]);


  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-3 font-semibold text-left">Customer ID</th>
              <th className="px-3 py-3 font-semibold text-left">Name</th>
              <th className="px-3 py-3 font-semibold text-left">Phone</th>
              <th className="px-3 py-3 font-semibold text-left">Source</th>
              <th className="px-3 py-3 font-semibold text-left">Stage</th>
              <th className="px-3 py-3 font-semibold text-left">Notes</th>
              <th className="px-3 py-3 font-semibold text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <SkeletonRows />
          </tbody>
        </table>
      </div>
    );
  }

  const rowCount = filteredData.length;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="space-y-4 p-4 bg-white sticky top-0 z-10 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative w-full sm:max-w-sm">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={20} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search followups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            />
          </div>

          {/* Stage Filter */}
          <div className="w-full sm:max-w-[200px]">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Stages</option>

              {stages.map((stage, idx) => (
                <option key={idx} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>


          {/* Dynamic Row Count */}
          <div className="text-sm font-medium text-gray-600">
            Showing <span className="font-bold text-blue-600">{rowCount}</span>{" "}
            result{rowCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mt-4 rounded-lg shadow-sm">
        {/* Desktop/Tablet Table View */}
        <div className="hidden md:block">
          <table className="min-w-full table-auto text-sm bg-white rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="px-3 py-3 font-semibold text-left">
                  Customer ID
                </th>
                <th className="px-3 py-3 font-semibold text-left">Name</th>
                <th className="px-3 py-3 font-semibold text-left">Phone</th>
                <th className="px-3 py-3 font-semibold text-left">Source</th>
                <th className="px-3 py-3 font-semibold text-left">Stage</th>
                <th className="px-3 py-3 font-semibold text-left">Notes</th>
                <th className="px-3 py-3 font-semibold text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.length > 0 ? (
                filteredData.map((f, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50 text-left transition-colors duration-150"
                  >
                    <td className="px-3 py-3">{f.customer_id}</td>
                    <td className="px-3 py-3">{f.name}</td>
                    <td className="px-3 py-3">{f.phone}</td>
                    <td className="px-3 py-3">{f.lead_source}</td>
                    <td className="px-3 py-3">{f.stage}</td>
                    <td className="px-3 py-3">{f.notes}</td>
                    <td className="px-3 py-3">
                      {dayjs(f.followed_date).format("DD-MMM-YYYY")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No followups found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4 p-4">
          {filteredData.length > 0 ? (
            filteredData.map((f, i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-2"
              >
                <div className="flex items-center justify-between text-sm font-medium text-gray-800">
                  <span>Customer ID:</span>
                  <span className="font-bold">{f.customer_id}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Name:</span>
                  <span className="text-right">{f.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Phone:</span>
                  <span className="text-right">{f.phone}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Source:</span>
                  <span className="text-right">{f.lead_source}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Stage:</span>
                  <span className="text-right">{f.stage}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Notes:</span>
                  <p className="mt-1 text-gray-800">{f.notes}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Date:</span>
                  <span className="text-right">
                    {dayjs(f.followed_date).format("DD-MMM-YYYY")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-sm text-center text-gray-500 border border-gray-200">
              No good followups found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
