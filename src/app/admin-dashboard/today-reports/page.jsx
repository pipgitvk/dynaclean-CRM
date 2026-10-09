// app/dashboard/page.jsx
"use client";
import { useState, useEffect, useCallback } from "react";
import SummaryBox from "@/components/SummaryBox";
import GoodFollowupsTable from "@/components/GoodFollowupsTable";
import Modal from "@/components/Modal";
import { Search } from "lucide-react";
import dayjs from "dayjs";
import weekday from "dayjs/plugin/weekday";
import weekOfYear from "dayjs/plugin/weekOfYear";

dayjs.extend(weekday);
dayjs.extend(weekOfYear);

export default function DashboardPage() {
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState({
    followups: [],
    quotations: [],
    newOrders: [],
    demos: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [dateRange, setDateRange] = useState("today");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    let startDate, endDate;

    const today = dayjs();
    switch (dateRange) {
      case "today":
        startDate = today.startOf("day").toISOString();
        endDate = today.endOf("day").toISOString();
        break;
      case "this_week":
        startDate = today.startOf("week").toISOString();
        endDate = today.endOf("week").toISOString();
        break;
      case "this_month":
        startDate = today.startOf("month").toISOString();
        endDate = today.endOf("month").toISOString();
        break;
      case "custom":
        startDate = dayjs(customFromDate).startOf("day").toISOString();
        endDate = dayjs(customToDate).endOf("day").toISOString();
        break;
      default:
        startDate = today.startOf("day").toISOString();
        endDate = today.endOf("day").toISOString();
    }

    try {
      const params = new URLSearchParams({
        employee: selectedEmployee,
        startDate,
        endDate,
      });
      const res = await fetch(`/api/dashboard-data?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      const fetchedData = await res.json();

      if (fetchedData.employees) {
        setEmployees(fetchedData.employees);
      } else {
        setEmployees([]);
      }

      setData({
        followups: fetchedData.followups || [],
        quotations: fetchedData.quotations || [],
        newOrders: fetchedData.newOrders || [],
        demos: fetchedData.demos || [],
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      setEmployees([]);
      setData({ followups: [], quotations: [], newOrders: [], demos: [] });
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmployee, dateRange, customFromDate, customToDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBoxClick = (title, records) => {
    setModalTitle(title);
    setModalData(records);
    setIsModalOpen(true);
  };

  const formattedDate = dayjs().format("DD MMM, YYYY");

  const tableData = {
    quotations: data.quotations.map((item) => ({
      "Quote #": item.quote_number,
      "Customer ID": item.customer_id,
      Company: item.company_name,
      "Employee Name": item.emp_name,
      // "Ship To": item.ship_to,
      "Grand Total": item.grand_total,
    })),
    newOrders: data.newOrders.map((item) => ({
      "Order ID": item.order_id,
      "Client Name": item.client_name,
      Contact: item.contact,
      Company: item.company_name,
      "Created By": item.created_by,
    })),
    demos: data.demos.map((item) => ({
      "Customer Name": item.customer_name,
      Mobile: item.mobile,
      Company: item.company,
      "Demo Date": dayjs(item.demo_date_time).format("DD-MMM-YYYY"),
      "Demo Date/Time": item.demo_date_time,
      Address: item.demo_address,
      Username: item.username,
      "Demo Status": item.demo_status,
      Machine1: item.machine1,
      Model1: item.model1,
      Machine2: item.machine2,
      Model2: item.model2,
      Machine3: item.machine3,
      Model3: item.model3,
    })),
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 border-b-2 pb-2">
        Daily Employee Dashboard
      </h1>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Employee Select */}
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Employee Name
          </label>
          <select
            name="employeeName"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Employees</option>
            {employees &&
              employees.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
          </select>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setDateRange("today")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "today"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRange("this_week")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "this_week"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setDateRange("this_month")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "this_month"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              This Month
            </button>
          </div>
          {/* Custom Date Picker */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto"
            />
            <span className="text-gray-500 hidden sm:block">to</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto"
            />
            <button
              onClick={() => {
                if (customFromDate && customToDate) {
                  setDateRange("custom");
                }
              }}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === "custom"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? "Fetching..." : "fetch"}
            </button>
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* 📊 Summary Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <SummaryBox
          title="Quotations"
          count={data.quotations.length}
          onClick={() =>
            handleBoxClick("Today's Quotations", tableData.quotations)
          }
          isLoading={isLoading}
        />
        <SummaryBox
          title="New Orders"
          count={data.newOrders.length}
          onClick={() =>
            handleBoxClick("Today's New Orders", tableData.newOrders)
          }
          isLoading={isLoading}
        />
        <SummaryBox
          title="Demo Registrations"
          count={data.demos.length}
          onClick={() =>
            handleBoxClick("Today's Demo Registrations", tableData.demos)
          }
          isLoading={isLoading}
        />
      </div>

      <hr className="border-gray-200" />

      {/* 📋 Good Followups Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Followups</h3>
          <GoodFollowupsTable data={data.followups} isLoading={isLoading} />
        </div>
      </div>

      {/* Reusable Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        data={modalData}
      />
    </div>
  );
}
