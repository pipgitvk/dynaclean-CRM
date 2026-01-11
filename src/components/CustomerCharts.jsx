// components/CustomerCharts.jsx
"use client";
import { useState, useEffect } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const ALLOWED_STATUSES = [
  "New",
  "Contacted",
  "Interested",
  "Demo Scheduled",
  "Demo Completed",
  "Qualified",
  "Quotation Sent",
  "Quotation Revised",
  "Negotiation / Follow-up",
  "Decision Pending",
  "Won (Order Received)",
  "Lost",
  "Disqualified / Invalid Lead",
  "Very Good",
  "Average",
  "Poor",
  "Denied",
];


const CAMPAIGN_DEFINITIONS = [
  { value: "india_mart", label: "India Mart", color: "#10B981" },
  { value: "social_media", label: "Social Media", color: "#EC4899" },
  { value: "google_ads", label: "Google Ads", color: "#A855F7" },
  { value: "visit", label: "Visit", color: "#F97316" },
  { value: "website_visit", label: "Website Visit", color: "#22D3EE" },
  { value: "reference", label: "Reference", color: "#3B82F6" },
];

export default function CustomerCharts({ customers, statusStats, campaignStats, stageStats }) {
  const [chartData, setChartData] = useState({
    status: {},
    campaign: {},
  });

  useEffect(() => {
    const hasAggregatedStats =
      (statusStats && statusStats.length > 0) ||
      (campaignStats && campaignStats.length > 0);

    if (!hasAggregatedStats && (!customers || customers.length === 0)) {
      return;
    }

    let statusCounts = {};
    let campaignCounts = {};

    // Prefer aggregated stage stats if provided, otherwise fall back to statusStats,
    // and finally derive from customers.stage
    if (stageStats && stageStats.length > 0) {
      statusCounts = stageStats.reduce((acc, row) => {
        if (!row.stage) return acc;
        if (!ALLOWED_STATUSES.includes(row.stage)) return acc;
        acc[row.stage] = (acc[row.stage] || 0) + Number(row.count || 0);
        return acc;
      }, {});
    } else if (statusStats && statusStats.length > 0) {
      statusCounts = statusStats.reduce((acc, row) => {
        if (!row.status) return acc;
        if (!ALLOWED_STATUSES.includes(row.status)) return acc;
        acc[row.status] = (acc[row.status] || 0) + Number(row.count || 0);
        return acc;
      }, {});
    }

    if (campaignStats && campaignStats.length > 0) {
      campaignCounts = campaignStats.reduce((acc, row) => {
        if (!row.campaign && !row.lead_campaign) return acc;
        const key = row.campaign || row.lead_campaign;
        const def = CAMPAIGN_DEFINITIONS.find((c) => c.value === key);
        if (!def) return acc;
        acc[key] = (acc[key] || 0) + Number(row.count || 0);
        return acc;
      }, {});
    }

    if ((!stageStats || stageStats.length === 0) && (!statusStats || statusStats.length === 0) && customers && customers.length) {
      statusCounts = customers.reduce((acc, curr) => {
        const key = curr.stage || curr.status;
        if (!key) return acc;
        if (!ALLOWED_STATUSES.includes(key)) return acc;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    }

    if ((!campaignStats || campaignStats.length === 0) && customers && customers.length) {
      campaignCounts = customers.reduce((acc, curr) => {
        if (!curr.lead_campaign) return acc;
        const def = CAMPAIGN_DEFINITIONS.find((c) => c.value === curr.lead_campaign);
        if (!def) return acc;
        acc[curr.lead_campaign] = (acc[curr.lead_campaign] || 0) + 1;
        return acc;
      }, {});
    }

    const statusLabels = Object.keys(statusCounts);
    const statusData = statusLabels.map((key) => statusCounts[key]);
    const statusColors = statusLabels.map((status) => {
      switch (status) {
        case "New":
          return "#3B82F6"; // Blue

        case "Contacted":
          return "#0EA5E9"; // Light Blue

        case "Interested":
          return "#14B8A6"; // Teal

        case "Demo Scheduled":
          return "#8B5CF6"; // Purple

        case "Demo Completed":
          return "#6366F1"; // Indigo

        case "Qualified":
          return "#10B981"; // Green

        case "Quotation Sent":
          return "#F59E0B"; // Amber

        case "Quotation Revised":
          return "#D97706"; // Dark Amber

        case "Negotiation / Follow-up":
          return "#EC4899"; // Pink

        case "Decision Pending":
          return "#A78BFA"; // Light Purple

        case "Won (Order Received)":
          return "#16A34A"; // Strong green

        case "Lost":
          return "#DC2626"; // Red

        case "Disqualified / Invalid Lead":
          return "#6B7280"; // Gray

        // Existing quality statuses
        case "Very Good":
          return "#22C55E"; // Green
        case "Average":
          return "#FACC15"; // Yellow
        case "Poor":
          return "#F97316"; // Orange
        case "Denied":
          return "#6B7280"; // Gray

        default:
          return "#9CA3AF"; // Default gray
      }
    });

    const campaignLabels = CAMPAIGN_DEFINITIONS
      .filter((def) => campaignCounts[def.value] > 0)
      .map((def) => def.label);
    const campaignData = CAMPAIGN_DEFINITIONS
      .filter((def) => campaignCounts[def.value] > 0)
      .map((def) => campaignCounts[def.value]);
    const campaignColors = CAMPAIGN_DEFINITIONS
      .filter((def) => campaignCounts[def.value] > 0)
      .map((def) => def.color);

    setChartData({
      status: {
        labels: statusLabels,
        datasets: [
          {
            data: statusData,
            backgroundColor: statusColors,
            borderColor: "#FFFFFF",
            borderWidth: 2,
          },
        ],
      },
      campaign: {
        labels: campaignLabels,
        datasets: [
          {
            data: campaignData,
            backgroundColor: campaignColors,
            borderColor: "#FFFFFF",
            borderWidth: 2,
          },
        ],
      },
    });
  }, [customers, statusStats, campaignStats]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: {
            size: 14,
            family: "sans-serif",
          },
          boxWidth: 20,
          padding: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || "";
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce(
              (sum, val) => sum + val,
              0
            );
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    layout: {
      padding: {
        top: 20,
        bottom: 20,
      },
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {chartData.status.labels && chartData.status.labels.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 aspect-w-1 aspect-h-1">
          <h4 className="text-center font-bold mb-4 text-gray-800">
            Customer Status Breakdown
          </h4>
          <div className="h-64 sm:h-80">
            <Pie data={chartData.status} options={chartOptions} />
          </div>
        </div>
      )}
      {chartData.campaign.labels && chartData.campaign.labels.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 aspect-w-1 aspect-h-1">
          <h4 className="text-center font-bold mb-4 text-gray-800">
            Lead Campaign Distribution
          </h4>
          <div className="h-64 sm:h-80">
            <Pie data={chartData.campaign} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
