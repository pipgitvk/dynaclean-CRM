"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ClipboardList, 
  Box, 
  Wrench, 
  Users, 
  ShoppingCart, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Calendar,
  Filter,
  Bell,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  FileText,
  PackageX
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import clsx from "clsx";
import ScheduleVisitCard from "@/components/scheduleVisit/ScheduleVisitCard";

// Simple card component like admin dashboard
const SimpleCard = ({ title, value, icon: Icon, borderColor, onClick, subtext, multiValues }) => {
  return (
    <a 
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-4 text-black hover:shadow-lg transition-shadow h-full cursor-pointer block border-l-4 min-h-[120px] flex flex-col justify-between ${borderColor}`}
    >
      <div>
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className="w-5 h-5 shrink-0" />}
          <h2 className="text-sm font-bold text-black leading-tight uppercase">
            {title}
          </h2>
        </div>
        
        {multiValues ? (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {multiValues.map((item, idx) => (
              <div key={idx} className="text-center">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">{item.label}</p>
                <p className="text-xl font-bold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold mt-1 text-gray-900">
              {value}
            </p>
            {subtext && (
              <p className="text-xs text-gray-600 mt-0.5">
                {subtext}
              </p>
            )}
          </>
        )}
      </div>
    </a>
  );
};

export default function DirectorDashboard({ user, reportingManager, regTotal = 0, regPending = 0 }) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Day");
  const [totalAvailableStockPrice, setTotalAvailableStockPrice] = useState(0);
  const [totalAvailableStockQty, setTotalAvailableStockQty] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [zeroStockCount, setZeroStockCount] = useState(0);
  const [kpiData, setKpiData] = useState({
    taskPending: 0,
    stockValue: 0,
    spareValue: 0,
    totalExpenses: 0,
    totalStockPurchase: 0,
    totalSparePurchase: 0,
    totalSale: 0,
    totalSaleAll: 0,
    totalStockPurchaseAll: 0,
    totalSparePurchaseAll: 0,
    totalProfit: 0,
    totalProfitAll: 0,
    servicePending: 0,
    serviceCompleted: 0,
    servicePendingSpares: 0,
  });

  useEffect(() => {
    fetchKpiData();
    fetchAvailableStockPrice();
    fetchLowStockAlerts();
    
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Morning");
    else if (hour < 17) setGreeting("Afternoon");
    else setGreeting("Evening");
  }, [dateFrom, dateTo]);

  const fetchAvailableStockPrice = async () => {
    try {
      const [availableStockRes, purchasePricesRes] = await Promise.all([
        fetch('/api/available-stock'),
        fetch('/api/stock-request')
      ]);

      const availableStock = await availableStockRes.json();
      const purchasePrices = await purchasePricesRes.json();

      const priceMap = {};
      purchasePrices.forEach((p) => {
        if (p.product_code && p.price_per_unit) {
          priceMap[p.product_code] = Number(p.price_per_unit);
        }
      });

      const total = availableStock.reduce((sum, row) => {
        const totalQty = (row.delhi || 0) + (row.south || 0);
        const pricePerUnit = priceMap[row.product_code] || 0;
        return sum + (totalQty * pricePerUnit);
      }, 0);

      const totalQty = availableStock.reduce((sum, row) => {
        return sum + ((row.delhi || 0) + (row.south || 0));
      }, 0);

      setTotalAvailableStockPrice(total);
      setTotalAvailableStockQty(totalQty);
    } catch (error) {
      console.error('Error fetching available stock price:', error);
    }
  };

  const fetchLowStockAlerts = async () => {
    try {
      const res = await fetch('/api/stock/low-stock');
      const data = await res.json();
      setLowStockCount(data.lowStockCount || 0);
      setZeroStockCount(data.zeroStockCount || 0);
    } catch (error) {
      console.error('Error fetching low stock alerts:', error);
    }
  };

  const fetchKpiData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/director/dashboard-kpi?from=${dateFrom}&to=${dateTo}`);
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      const data = await res.json();
      setKpiData(data);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-t-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">

      {/* Dashboard Cards Grid - Same as Admin Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 md:gap-3">
        {/* Pending Tasks */}
        <SimpleCard
          title="Pending Tasks"
          value={kpiData.taskPending}
          icon={ClipboardList}
          borderColor="border-blue-500"
          onClick={() => router.push("/director-dashboard/task-manager")}
        />

        {/* Available Stock Value */}
        <SimpleCard
          title="Available Stock"
          value={`₹${Number(totalAvailableStockPrice || 0).toLocaleString('en-IN')}`}
          icon={Box}
          borderColor="border-green-500"
          subtext={`Qty: ${totalAvailableStockQty.toLocaleString('en-IN')}`}
          onClick={() => router.push("/director-dashboard/product-stock")}
        />

        {/* Low Stock Alerts */}
        <SimpleCard
          title="Low Stock Alerts"
          value={lowStockCount}
          icon={PackageX}
          borderColor="border-red-500"
          onClick={() => router.push("/director-dashboard/product-stock")}
        />

        {/* Spare Value */}
        <SimpleCard
          title="Spare Value"
          value={`₹${Number(kpiData.spareValue || 0).toLocaleString('en-IN')}`}
          icon={Wrench}
          borderColor="border-emerald-500"
          onClick={() => router.push("/director-dashboard/spare")}
        />

        {/* Employee Expenses */}
        <SimpleCard
          title="Employee Expenses"
          value={`₹${Number(kpiData.totalExpensesAll || 0).toLocaleString('en-IN')}`}
          icon={Users}
          borderColor="border-indigo-500"
          onClick={() => router.push("/director-dashboard/all-expenses")}
        />

        {/* Stock Purchase */}
        <SimpleCard
          title="Stock Purchase"
          value={`₹${Number(kpiData.totalStockPurchaseAll || 0).toLocaleString('en-IN')}`}
          icon={ShoppingCart}
          borderColor="border-teal-500"
          onClick={() => router.push("/director-dashboard/purchase/purchases")}
        />

        {/* Spare Purchase */}
        <SimpleCard
          title="Spare Purchase"
          value={`₹${Number(kpiData.totalSparePurchaseAll || 0).toLocaleString('en-IN')}`}
          icon={Settings}
          borderColor="border-purple-500"
          onClick={() => router.push("/director-dashboard/spare/purchase/purchases")}
        />

        {/* Total Revenue */}
        <SimpleCard
          title="Total Revenue"
          value={`₹${Number(kpiData.totalSaleAll || 0).toLocaleString('en-IN')}`}
          icon={DollarSign}
          borderColor="border-green-600"
          onClick={() => router.push("/director-dashboard/total-revenue")}
        />

        {/* Net Profit */}
        <SimpleCard
          title="Net Profit"
          value={`₹${Number(kpiData.totalProfitAll || kpiData.totalProfit || 0).toLocaleString('en-IN')}`}
          icon={TrendingUp}
          borderColor="border-blue-600"
          onClick={() => router.push("/director-dashboard")}
        />

        {/* Service Operations */}
        <SimpleCard
          title="Service Operations"
          icon={Wrench}
          borderColor="border-amber-600"
          multiValues={[
            { label: "Done", value: kpiData.serviceCompleted },
            { label: "Wait", value: kpiData.servicePending },
            { label: "Spares", value: kpiData.servicePendingSpares }
          ]}
          onClick={() => router.push("/director-dashboard/view_service_reports")}
        />

        {/* Attendance Regularization */}
        <SimpleCard
          title="Attendance"
          value={regPending}
          icon={Calendar}
          borderColor="border-orange-600"
          subtext={`${regTotal} Total`}
          onClick={() => router.push("/director-dashboard/attendance-regularization")}
        />
      </div>
    </div>
  );
}
