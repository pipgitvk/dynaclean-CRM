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
  DollarSign
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

// Mock sparkline data
const sparklineData = [
  { value: 40 }, { value: 30 }, { value: 45 }, { value: 35 }, { value: 55 }, { value: 40 }, { value: 60 }
];

const salesProfitData = [
  { month: "Dec '24", sale: 15, profit: 8 },
  { month: "Jan '25", sale: 22, profit: 12 },
  { month: "Feb '25", sale: 18, profit: 9 },
  { month: "Mar '25", sale: 25, profit: 14 },
  { month: "Apr '25", sale: 20, profit: 11 },
  { month: "May '25", sale: 28, profit: 16 },
];

const serviceStatusData = [
  { name: "Pending", value: 12, color: "#f97316" },
  { name: "Completed", value: 56, color: "#22c55e" },
  { name: "Pending for Spares", value: 7, color: "#ef4444" },
];

const expenseBreakdownData = [
  { name: "Salary", value: 85000, color: "#6366f1" },
  { name: "Fuel", value: 25000, color: "#eab308" },
  { name: "Office", value: 20000, color: "#a855f7" },
  { name: "Miscellaneous", value: 15000, color: "#06b6d4" },
];

const KPICard = ({ title, value, icon: Icon, subtext, gradient, buttonText, onClick, isMultiValue, multiValues, buttonOnSide, multiValueColors }) => (
  <div 
    className={clsx(
      "rounded-2xl shadow-lg p-6 flex flex-col gap-4 transition-all hover:scale-[1.02] cursor-pointer text-white h-[220px]",
      gradient
    )}
    onClick={onClick}
  >
    <div className="flex items-center gap-2">
      <div className="bg-white/20 p-2 rounded-lg">
        {Icon && <Icon size={20} className="text-white" />}
      </div>
      <h3 className="font-bold text-lg tracking-tight">{title}</h3>
    </div>
    
    <div className="flex-1 flex flex-col justify-center">
      {isMultiValue ? (
        <div className="grid grid-cols-2 gap-2">
          {multiValues.slice(0, 2).map((item, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center bg-white/10 rounded-xl px-2 py-2 border border-white/5">
              <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">{item.label}</span>
              <span className={`text-xl font-black ${multiValueColors?.[idx] || 'text-white'}`}>{item.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="text-4xl font-black tracking-tight">{value}</p>
          {subtext && <p className="text-sm font-medium text-white/80 mt-1">{subtext}</p>}
        </>
      )}
      {isMultiValue && multiValues[2] && (
        buttonOnSide ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 flex flex-col items-center justify-center bg-white/10 rounded-xl px-3 py-2 border border-white/5">
              <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">{multiValues[2].label}</span>
              <span className={`text-xl font-black ${multiValueColors?.[2] || 'text-white'}`}>{multiValues[2].value}</span>
            </div>
            <div className="inline-flex items-center bg-white text-slate-800 px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm hover:bg-slate-50 transition-colors group/btn">
              {buttonText || "View Details"}
              <span className="ml-1.5 transform group-hover/btn:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-col items-center justify-center bg-white/10 rounded-xl px-3 py-2 border border-white/5">
            <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">{multiValues[2].label}</span>
            <span className={`text-xl font-black ${multiValueColors?.[2] || 'text-white'}`}>{multiValues[2].value}</span>
          </div>
        )
      )}
    </div>
    
    {!buttonOnSide && (
      <div className="mt-auto pt-2">
        <div className="inline-flex items-center bg-white text-slate-800 px-5 py-2 rounded-xl text-sm font-extrabold shadow-sm hover:bg-slate-50 transition-colors group/btn">
          {buttonText || "View Details"}
          <span className="ml-2 transform group-hover/btn:translate-x-1 transition-transform">→</span>
        </div>
      </div>
    )}
  </div>
);

export default function DirectorDashboard({ user }) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    taskPending: 0,
    stockValue: 0,
    spareValue: 0,
    totalExpenses: 0,
    totalStockPurchase: 0,
    totalSparePurchase: 0,
    totalSale: 0,
    totalProfit: 0,
    servicePending: 0,
    serviceCompleted: 0,
    servicePendingSpares: 0,
  });

  useEffect(() => {
    fetchKpiData();
  }, [dateFrom, dateTo]);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Director Dashboard</h1>
          <p className="text-slate-500 text-sm font-medium">Business Overview & Key Metrics</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard 
          title="Pending Tasks" 
          value={kpiData.taskPending} 
          icon={ClipboardList} 
          gradient="bg-gradient-to-br from-purple-600 to-blue-500"
          buttonText="View Tasks"
          onClick={() => router.push("/director-dashboard/task-manager")}
        />
        <KPICard 
          title="Stock Value" 
          value={`₹${Number(kpiData.stockValue || 0).toLocaleString('en-IN')}`} 
          icon={Box} 
          gradient="bg-gradient-to-br from-blue-500 to-purple-600"
          buttonText="View Stock"
          subtext="Total inventory value"
          onClick={() => router.push("/director-dashboard/product-stock")}
        />
        <KPICard 
          title="Spare Value" 
          value={`₹${Number(kpiData.spareValue || 0).toLocaleString('en-IN')}`} 
          icon={Wrench} 
          gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
          buttonText="View Spares"
          subtext="Total spares inventory"
          onClick={() => router.push("/director-dashboard/spare")}
        />
        <KPICard 
          title="Employee Expenses" 
          value={`₹${Number(kpiData.totalExpensesAll || 0).toLocaleString('en-IN')}`} 
          icon={Users} 
          gradient="bg-gradient-to-br from-blue-600 to-blue-400"
          buttonText="Review Expenses"
          subtext="Pending approvals"
          onClick={() => router.push("/director-dashboard/all-expenses")}
        />
        <KPICard 
          title="Stock Purchase" 
          value={`₹${Number(kpiData.totalStockPurchaseAll || 0).toLocaleString('en-IN')}`} 
          icon={ShoppingCart} 
          gradient="bg-gradient-to-br from-teal-500 to-emerald-400"
          buttonText="View Purchases"
          subtext="Monthly stock inward"
          onClick={() => router.push("/director-dashboard/purchase/purchases")}
        />
        <KPICard 
          title="Spare Purchase" 
          value={`₹${Number(kpiData.totalSparePurchaseAll || 0).toLocaleString('en-IN')}`} 
          icon={Settings} 
          gradient="bg-gradient-to-br from-indigo-500 to-purple-500"
          buttonText="View Purchases"
          subtext="Monthly spare inward"
          onClick={() => router.push("/director-dashboard/spare/purchase/purchases")}
        />
        <KPICard 
          title="Total Sale" 
          value={`₹${Number(kpiData.totalSale || 0).toLocaleString('en-IN')}`} 
          icon={DollarSign} 
          gradient="bg-gradient-to-br from-green-500 to-emerald-500"
          buttonText="View Details"
          subtext="Monthly revenue"
          onClick={() => router.push("/director-dashboard/purchase/purchases")}
        />
        <KPICard 
          title="Total Profit" 
          value={`₹${Number(kpiData.totalProfit || 0).toLocaleString('en-IN')}`} 
          icon={TrendingUp} 
          gradient="bg-gradient-to-br from-blue-500 to-cyan-400"
          buttonText="Review Profit"
          subtext="Net earnings"
        />
        <KPICard 
          title="Service Overview" 
          isMultiValue={true}
          multiValues={[
            { label: "Completed", value: kpiData.serviceCompleted },
            { label: "Pending", value: kpiData.servicePending },
            { label: "Pending Spares", value: kpiData.servicePendingSpares }
          ]}
          multiValueColors={["text-white", "text-white", "text-white"]}
          icon={Wrench} 
          gradient="bg-gradient-to-br from-green-500 to-emerald-600"
          buttonText="View Records"
          buttonOnSide={true}
          onClick={() => router.push("/director-dashboard/view_service_reports")}
        />
      </div>
    </div>
  );
}
