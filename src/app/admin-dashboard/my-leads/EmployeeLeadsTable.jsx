"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function EmployeeLeadsTable() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterCreatedBy, setFilterCreatedBy] = useState("all");
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const campaign = searchParams.get("campaign");
    fetchLeads(campaign);
  }, [searchParams]);

  const fetchLeads = async (campaign) => {
    try {
      setLoading(true);
      const url = campaign
        ? `/api/employee-leads?campaign=${campaign}`
        : "/api/employee-leads";
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setLeads(result.data);
      } else {
        setError(result.error || "Failed to fetch leads");
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
      setError("An error occurred while fetching leads");
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage) => {
    const colors = {
      "Customer Created": "bg-blue-100 text-blue-800",
      "Quotation Created": "bg-yellow-100 text-yellow-800",
      "Order Created": "bg-purple-100 text-purple-800",
      "Order Processed": "bg-green-100 text-green-800",
    };
    return colors[stage] || "bg-gray-100 text-gray-800";
  };

  // Get unique values for filters
  const uniqueCampaigns = [
    ...new Set(leads.map((lead) => lead.lead_campaign).filter(Boolean)),
  ];
  const uniqueCreators = [
    ...new Set(leads.map((lead) => lead.created_by).filter(Boolean)),
  ];

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm);

    let matchesStage = false;
    if (filterStage === "all") {
      matchesStage = true;
    } else if (filterStage === "Quotation Created") {
      matchesStage =
        lead.current_stage === "Quotation Created" ||
        lead.current_stage === "Order Created" ||
        lead.current_stage === "Order Processed";
    } else if (filterStage === "Order Created") {
      matchesStage =
        lead.current_stage === "Order Created" ||
        lead.current_stage === "Order Processed";
    } else {
      matchesStage = lead.current_stage === filterStage;
    }

    const matchesCampaign =
      filterCampaign === "all" || lead.lead_campaign === filterCampaign;
    const matchesCreatedBy =
      filterCreatedBy === "all" || lead.created_by === filterCreatedBy;

    let matchesDate = true;
    if (startDate || endDate) {
      const leadDate = lead.date_created ? new Date(lead.date_created) : null;
      if (!leadDate) {
        matchesDate = false;
      } else {
        const startDateObj = startDate ? new Date(startDate) : null;
        const endDateObj = endDate
          ? new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000)
          : null; // endDate inclusive

        if (startDateObj && leadDate < startDateObj) {
          matchesDate = false;
        }
        if (endDateObj && leadDate >= endDateObj) {
          matchesDate = false;
        }
      }
    }

    return (
      matchesSearch &&
      matchesStage &&
      matchesCampaign &&
      matchesCreatedBy &&
      matchesDate
    );
  });

  // Calculate KPIs based on filtered leads (respecting date range & other filters)
  const uniqueCustomers = [
    ...new Set(filteredLeads.map((lead) => lead.customer_id)),
  ];
  const totalLeads = uniqueCustomers.length;
  const quotationsCreated = filteredLeads.filter(
    (lead) => lead.quote_number
  ).length;
  const ordersCreated = filteredLeads.filter(
    (lead) => lead.order_id && lead.account_status === 1
  ).length;
  const ordersProcessed = filteredLeads.filter(
    (lead) =>
      lead.order_id && lead.account_status === 1 && lead.dispatch_status === 1
  ).length;
  const conversionRatio =
    totalLeads > 0 ? (ordersCreated / totalLeads) * 100 : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
        <p className="font-semibold">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, company, email, or phone..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
          >
            <option value="all">All Stages</option>
            <option value="Customer Created">Customer Created</option>
            <option value="Quotation Created">Quotation Created</option>
            <option value="Order Created">Order Created</option>
            <option value="Order Processed">Order Processed</option>
          </select>
        </div>
        <div>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filterCampaign}
            onChange={(e) => setFilterCampaign(e.target.value)}
          >
            <option value="all">All Campaigns</option>
            {uniqueCampaigns.map((campaign) => (
              <option key={campaign} value={campaign}>
                {campaign}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filterCreatedBy}
            onChange={(e) => setFilterCreatedBy(e.target.value)}
          >
            <option value="all">All Creators</option>
            {uniqueCreators.map((creator) => (
              <option key={creator} value={creator}>
                {creator}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left"
          onClick={() => setFilterStage("all")}
        >
          <p className="text-sm text-gray-600">Total Leads</p>
          <p className="text-2xl font-bold text-blue-700">{totalLeads}</p>
        </button>
        <button
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left"
          onClick={() => setFilterStage("Quotation Created")}
        >
          <p className="text-sm text-gray-600">Quotations Created</p>
          <p className="text-2xl font-bold text-yellow-700">
            {quotationsCreated}
          </p>
        </button>
        <button
          className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-left"
          onClick={() => setFilterStage("Order Created")}
        >
          <p className="text-sm text-gray-600">Orders Created</p>
          <p className="text-2xl font-bold text-purple-700">{ordersCreated}</p>
          <p className="text-xs text-gray-600 mt-1">
            Conversion: {conversionRatio.toFixed(1)}%
          </p>
        </button>
        <button
          className="bg-green-50 border border-green-200 rounded-lg p-4 text-left"
          onClick={() => setFilterStage("Order Processed")}
        >
          <p className="text-sm text-gray-600">Orders Processed</p>
          <p className="text-2xl font-bold text-green-700">{ordersProcessed}</p>
        </button>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600 mb-2">
        Showing {filteredLeads.length} of {leads.length} leads
      </div>

      {/* Table: mobile cards + desktop table */}
      <div className="space-y-4">
        {/* Mobile / small screens: card layout */}
        <div className="md:hidden space-y-3">
          {filteredLeads.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 bg-white rounded-lg border">
              No leads found
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isOrderProcessed = lead.order_processed === 1;

              return (
                <div
                  key={`${lead.customer_id}-${lead.quote_number || "no-quote"}`}
                  className="bg-white border rounded-lg p-4 shadow-sm cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/admin-dashboard/view-customer/${lead.customer_id}`
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {lead.first_name} {lead.last_name}
                      </div>
                      <div className="text-xs text-gray-500 break-all">
                        {lead.email}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-semibold ${getStageColor(
                        lead.current_stage
                      )}`}
                    >
                      {lead.current_stage}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-gray-700 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium">Company:</span>
                      <span className="ml-2 text-right">
                        {lead.company || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Phone:</span>
                      <span className="ml-2 text-right">
                        {lead.phone || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Campaign:</span>
                      <span className="ml-2 text-right">
                        {lead.lead_campaign || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Created By:</span>
                      <span className="ml-2 text-right">
                        {lead.created_by || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 border-t pt-2 text-xs text-gray-700 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium">Quotation:</span>
                      <span className="ml-2 text-right">
                        {lead.quote_number
                          ? `${lead.quote_number} (${
                              lead.quote_date
                                ? new Date(lead.quote_date).toLocaleDateString()
                                : "-"
                            })`
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Order:</span>
                      <span className="ml-2 text-right">
                        {lead.order_id
                          ? `${lead.invoice_number || lead.order_id} (${
                              lead.invoice_date
                                ? new Date(
                                    lead.invoice_date
                                  ).toLocaleDateString()
                                : "-"
                            })`
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Processed:</span>
                      <span className="ml-2">
                        {isOrderProcessed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                            ✓ Yes
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                            ✗ No
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Date Created:</span>
                      <span className="ml-2 text-right">
                        {lead.date_created
                          ? new Date(lead.date_created).toLocaleDateString()
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop / larger screens: table layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quotation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Processed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td
                    colSpan="10"
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No leads found
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isOrderProcessed = lead.order_processed === 1;

                  return (
                    <tr
                      key={`${lead.customer_id}-${
                        lead.quote_number || "no-quote"
                      }`}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/admin-dashboard/view-customer/${lead.customer_id}`
                        )
                      }
                    >
                      <td className="px-4 py-3 text-sm max-w-xs">
                        <div className="font-medium text-gray-900 wrap-break-words">
                          {lead.first_name} {lead.last_name}
                        </div>
                        <div className="text-gray-500 text-xs break-all">
                          {lead.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs wrap-break-words">
                        {lead.company || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {lead.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {lead.lead_campaign || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${getStageColor(
                            lead.current_stage
                          )}`}
                        >
                          {lead.current_stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {lead.quote_number ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {lead.quote_number}
                            </div>
                            <div className="text-gray-500 text-xs">
                              {lead.quote_date
                                ? new Date(lead.quote_date).toLocaleDateString()
                                : "-"}
                            </div>
                            <div className="text-gray-600 text-xs">
                              ₹{lead.quotation_amount?.toLocaleString() || "0"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {lead.order_id ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {lead.invoice_number || lead.order_id}
                            </div>
                            <div className="text-gray-500 text-xs">
                              {lead.invoice_date
                                ? new Date(
                                    lead.invoice_date
                                  ).toLocaleDateString()
                                : "-"}
                            </div>
                            <div className="text-gray-600 text-xs">
                              ₹{lead.order_amount?.toLocaleString() || "0"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {isOrderProcessed ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            ✓ Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            ✗ No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {lead.created_by || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {lead.date_created
                          ? new Date(lead.date_created).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
