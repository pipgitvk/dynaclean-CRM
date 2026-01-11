// components/CustomerTable.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Search, Download } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

dayjs.extend(utc);

const SkeletonRows = () => (
  <>
    {[...Array(5)].map((_, i) => (
      <tr key={i} className="animate-pulse border-b border-gray-200">
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-8"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </td>
        <td className="px-3 py-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </td>
      </tr>
    ))}
  </>
);

const SkeletonCards = () => (
  <>
    {[...Array(3)].map((_, i) => (
      <div
        key={i}
        className="bg-gray-100 border rounded-xl shadow-sm p-4 space-y-2 animate-pulse"
      >
        <div className="h-6 bg-gray-200 w-3/4 rounded"></div>
        <div className="h-4 bg-gray-200 w-1/2 rounded"></div>
        <div className="h-4 bg-gray-200 w-2/3 rounded"></div>
      </div>
    ))}
  </>
);

export default function CustomerTable({ customers, isLoading }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Read search query from URL on initial load
  useEffect(() => {
    const queryFromUrl = searchParams.get("search") || "";
    setSearchQuery(queryFromUrl);
  }, [searchParams]);

  // Use useMemo for efficient filtering based on customers and searchQuery
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];

    const lowercasedQuery = searchQuery.toLowerCase();
    let result = customers.filter((customer) =>
      Object.values(customer).some(
        (value) =>
          value && value.toString().toLowerCase().includes(lowercasedQuery)
      )
    );

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? "";
        const bVal = b[sortConfig.key] ?? "";
        if (aVal < bVal) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [searchQuery, customers, sortConfig]);

  // Update URL search parameter when search input changes
  const handleSearchChange = (e) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    const newParams = new URLSearchParams(searchParams);
    if (newQuery) {
      newParams.set("search", newQuery);
    } else {
      newParams.delete("search");
    }
    router.push(`?${newParams.toString()}`);
  };

  const downloadPDF = () => {
    if (filteredCustomers.length === 0) {
      toast.error("No data to download.");
      return;
    }
    const doc = new jsPDF();
    const tableData = filteredCustomers.map((c, i) => [
      i + 1,
      dayjs.utc(c.date_created).format("DD-MMM-YYYY"),
      c.lead_campaign,
      c.first_name,
      c.company,
      c.status,
      c.stage || "-",
      c.lead_source,
    ]);
    autoTable(doc, {
      head: [["#", "Date", "Campaign", "Name", "Company", "Status", "Stage", "Source"]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: "#e5e7eb", textColor: 0, fontStyle: "bold" },
    });
    doc.save("customers.pdf");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded-lg w-full max-w-sm mb-4"></div>
        <div className="hidden lg:block overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full table-auto text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-3 font-semibold text-center">#</th>
                <th className="px-3 py-3 font-semibold text-left">Date</th>
                <th className="px-3 py-3 font-semibold text-left">Campaign</th>
                <th className="px-3 py-3 font-semibold text-left">Name</th>
                <th className="px-3 py-3 font-semibold text-left">Company</th>
                <th className="px-3 py-3 font-semibold text-left">Status</th>
                <th className="px-3 py-3 font-semibold text-left">Source</th>
                <th className="px-3 py-3 font-semibold text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <SkeletonRows />
            </tbody>
          </table>
        </div>
        <div className="lg:hidden space-y-4">
          <SkeletonCards />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:max-w-sm">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search table..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          />
        </div>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 bg-gray-200 text-gray-800 py-2 px-4 rounded-md shadow-sm hover:bg-gray-300 transition-colors hidden"
        >
          <Download className="w-4 h-4" /> Download PDF
        </button>
      </div>

      <div className="hidden lg:block overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="min-w-full table-auto text-sm bg-white rounded-lg overflow-hidden shadow-sm">
          <thead className="bg-gray-50 text-gray-600 sticky top-0">
            <tr>
              <th className="px-3 py-3 font-semibold text-center">#</th>
              <th className="px-3 py-3 font-semibold text-left">Date</th>
              <th className="px-3 py-3 font-semibold text-left">Campaign</th>
              <th className="px-3 py-3 font-semibold text-left">Name</th>
              <th className="px-3 py-3 font-semibold text-left">Company</th>
              <th className="px-3 py-3 font-semibold text-left">Status</th>
              <th className="px-3 py-3 font-semibold text-left">Stage</th>
              <th className="px-3 py-3 font-semibold text-left">Source</th>
              <th className="px-3 py-3 font-semibold text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((c, i) => (
                <tr
                  key={c.customer_id}
                  className="hover:bg-gray-50 text-center transition-colors duration-150"
                >
                  <td className="px-3 py-3">{i + 1}</td>
                  <td className="px-3 py-3 text-left">
                    {dayjs.utc(c.date_created).format("DD-MMM-YYYY")}
                  </td>
                  <td className="px-3 py-3 text-left">{c.lead_campaign}</td>
                  <td className="px-3 py-3 text-left">{c.first_name}</td>
                  <td className="px-3 py-3 text-left whitespace-normal break-words max-w-[200px]">
                    {c.company}
                  </td>
                  <td className="px-3 py-3 text-left">{c.status}</td>
                  <td className="px-3 py-3 text-left">
                    {c.stage ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {c.stage}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-3 text-left">{c.lead_source}</td>
                  <td className="px-3 py-3 text-left">
                    <Link
                      href={`/user-dashboard/view-customer/${c.customer_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Followups
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden space-y-4">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((c, i) => (
            <div
              key={c.customer_id}
              className="bg-white border rounded-xl shadow-md p-4 space-y-2 text-sm"
            >
              <div className="flex justify-between items-center text-gray-500">
                <span className="text-xs font-medium">#{i + 1}</span>
                <span className="font-medium text-gray-800">
                  {dayjs.utc(c.date_created).format("DD-MMM-YYYY")}
                </span>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-lg text-gray-900">
                  {c.first_name}
                </div>
                <div className="break-words whitespace-normal">
                  <strong>Company:</strong> {c.company}
                </div>
                <div>
                  <strong>Campaign:</strong> {c.lead_campaign}
                </div>
                <div>
                  <strong>Status:</strong> {c.status}
                </div>
                <div>
                  <strong>Stage:</strong> {c.stage || "-"}
                </div>
                <div>
                  <strong>Source:</strong> {c.lead_source}
                </div>
                <div>
                  <Link
                    href={`/user-dashboard/view-customer/${c.customer_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Followups
                  </Link>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500">No customers found.</p>
        )}
      </div>
    </div>
  );
}
