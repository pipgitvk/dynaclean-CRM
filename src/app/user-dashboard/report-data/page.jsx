// pages/dashboard.jsx
"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, Users, FileText } from "lucide-react";
import DynamicTable from "@/components/DynamicTable"; // Import the new component

const Dashboard = () => {
  const [cardData, setCardData] = useState(null);
  const [loadingCard, setLoadingCard] = useState(true);
  const [tableData, setTableData] = useState(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState(null);
  const [activeCard, setActiveCard] = useState(null);

  useEffect(() => {
    const fetchCardData = async () => {
      try {
        setLoadingCard(true);
        const response = await fetch("/api/card-data");
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard summary.");
        }
        const result = await response.json();
        setCardData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingCard(false);
      }
    };
    fetchCardData();
  }, []);

  const handleCardClick = async (cardType) => {
    setActiveCard(cardType);
    setTableData(null); // Clear previous table data
    setLoadingTable(true);
    try {
      const response = await fetch(`/api/table-data?type=${cardType}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${cardType} data.`);
      }
      const result = await response.json();
      setTableData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTable(false);
    }
  };

  if (loadingCard) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  const { username, quotationsCount, customersCount, ordersCount } =
    cardData || {};

  // Define columns for each table type
  const columnsConfig = {
    quotations: [
      { key: "quote_number", header: "Quote Number", sortable: true },
      { key: "emp_name", header: "Employee Name", sortable: true },
      { key: "company_name", header: "Company Name", sortable: true },
      { key: "state", header: "State", sortable: true },
      { key: "ship_to", header: "Shipped", sortable: true },
      { key: "gst", header: "GST", sortable: true },
      { key: "grand_total", header: "Grand Total", sortable: true },
    ],
    customers: [
      { key: "first_name", header: "Customer Name", sortable: true },
      { key: "lead_source", header: "Lead Source", sortable: true },
      { key: "status", header: "Status", sortable: true },
      { key: "email", header: "Email", sortable: true },
      { key: "phone", header: "Phone", sortable: true },
      { key: "products_interest", header: "Product", sortable: true },
    ],
    orders: [
      { key: "invoice_number", header: "Invoice Number", sortable: true },
      { key: "client_name", header: "Cleint Name", sortable: true },
      { key: "contact", header: "Contact", sortable: true },
      { key: "company_name", header: "Company Name", sortable: true },
      { key: "delivery_location", header: "Location", sortable: true },
      { key: "totalamt", header: "Amount", sortable: true },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Fast Cards</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card components remain the same */}
        <div
          onClick={() => handleCardClick("quotations")}
          className="bg-white rounded-lg shadow-lg p-6 flex flex-col justify-between cursor-pointer transition-transform duration-200 hover:scale-105"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-700">
              Total Quotations
            </h2>
            <LayoutDashboard size={28} className="text-blue-500" />
          </div>
          <p className="text-4xl font-bold text-gray-900">{quotationsCount}</p>
        </div>
        <div
          onClick={() => handleCardClick("customers")}
          className="bg-white rounded-lg shadow-lg p-6 flex flex-col justify-between cursor-pointer transition-transform duration-200 hover:scale-105"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-700">
              Good Customers
            </h2>
            <Users size={28} className="text-green-500" />
          </div>
          <p className="text-4xl font-bold text-gray-900">{customersCount}</p>
        </div>
        <div
          onClick={() => handleCardClick("orders")}
          className="bg-white rounded-lg shadow-lg p-6 flex flex-col justify-between cursor-pointer transition-transform duration-200 hover:scale-105"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-700">Sales</h2>
            <FileText size={28} className="text-purple-500" />
          </div>
          <p className="text-4xl font-bold text-gray-900">{ordersCount}</p>
        </div>
      </div>

      {/* Dynamic Table Section */}
      {activeCard && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 capitalize">
            {activeCard} Details
          </h2>
          {loadingTable && (
            <div className="text-center text-gray-500">
              Loading table data...
            </div>
          )}
          {tableData && (
            <DynamicTable
              data={tableData}
              columns={columnsConfig[activeCard]}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
