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
  FileText
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

const KPICard = ({ title, value, icon: Icon, subtext, gradient, buttonText, onClick, isMultiValue, multiValues, buttonOnSide, multiValueColors, trend, trendValue }) => {
  return (
    <div 
      className="relative overflow-hidden rounded-[2rem] p-6 flex flex-col gap-4 transition-all duration-300 hover:shadow-xl cursor-pointer bg-white border border-slate-100 group h-[240px]"
      onClick={onClick}
    >
      {/* Subtle Background Accent */}
      <div className={clsx("absolute top-0 right-0 w-32 h-32 opacity-[0.03] transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12", gradient)}></div>

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx("p-2.5 rounded-xl shadow-sm border border-white/20 transition-all duration-300 group-hover:shadow-md text-white", gradient)}>
            {Icon && <Icon size={20} className="drop-shadow-sm" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 tracking-tight text-sm uppercase opacity-80">{title}</h3>
            {trendValue && (
              <div className={clsx(
                "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border",
                trend === 'up' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
              )}>
                {trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {trendValue}%
              </div>
            )}
          </div>
        </div>
        <div className="text-slate-300 group-hover:text-slate-400 transition-colors">
          <ArrowUpRight size={18} />
        </div>
      </div>
      
      {/* Content Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-center">
        {isMultiValue ? (
          <div className="grid grid-cols-2 gap-3">
            {multiValues.slice(0, 2).map((item, idx) => (
              <div key={idx} className="flex flex-col bg-slate-50/80 rounded-2xl px-3 py-3 border border-slate-100/50 transition-all group-hover:bg-white group-hover:shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</span>
                <span className="text-xl font-black text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            <p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight group-hover:scale-[1.02] transition-transform origin-left duration-300">{value}</p>
            {subtext && (
              <p className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-2">
                <span className="w-4 h-[1px] bg-slate-200"></span>
                {subtext}
              </p>
            )}
          </div>
        )}
        
        {isMultiValue && multiValues[2] && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 flex flex-col bg-slate-50/80 rounded-2xl px-4 py-2 border border-slate-100/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{multiValues[2].label}</span>
              <span className="text-lg font-black text-slate-800">{multiValues[2].value}</span>
            </div>
            {buttonOnSide && (
              <div className={clsx("h-full px-4 py-3 flex items-center justify-center rounded-xl text-[10px] font-black shadow-sm transition-all active:scale-95 uppercase tracking-widest text-white hover:shadow-md", gradient)}>
                {buttonText || "GO"}
              </div>
            )}
          </div>
        )}
      </div>
      
      {!buttonOnSide && (
        <div className="relative z-10 mt-auto pt-2 border-t border-slate-50">
          <div className="flex items-center justify-between text-slate-400 hover:text-slate-600 transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest">{buttonText || "VIEW DETAILS"}</span>
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      )}
    </div>
  );
};

export default function DirectorDashboard({ user }) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Day");
  const [totalAvailableStockPrice, setTotalAvailableStockPrice] = useState(0);
  const [totalAvailableStockQty, setTotalAvailableStockQty] = useState(0);
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
    fetchAvailableStockPrice();
    
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
      {/* Professional Executive Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Good {greeting}, <span className="text-blue-600">{user?.username || "Director"}</span>
          </h1>
          <div className="flex items-center gap-2 text-slate-400 font-semibold text-xs">
            <Calendar size={14} />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard
          title="Pending Tasks"
          value={kpiData.taskPending}
          icon={ClipboardList}
          gradient="bg-blue-600"
          buttonText="VIEW TASKS"
          trend="up"
          trendValue="12"
          onClick={() => router.push("/director-dashboard/task-manager")}
        />
        <KPICard
          title="Available Stock Value"
          value={`₹${Number(totalAvailableStockPrice || 0).toLocaleString('en-IN')}`}
          icon={Box}
          gradient="bg-green-600"
          buttonText="INVENTORY"
          subtext={`Total Qty: ${totalAvailableStockQty.toLocaleString('en-IN')}`}
          onClick={() => router.push("/director-dashboard/product-stock")}
        />
        {/* <KPICard
          title="Stock Value"
          value={`₹${Number(kpiData.stockValue || 0).toLocaleString('en-IN')}`}
          icon={Box}
          gradient="bg-slate-800"
          buttonText="INVENTORY"
          subtext="Net Asset Value"
          trend="down"
          trendValue="3.2"
          onClick={() => router.push("/director-dashboard/product-stock")}
        /> */}
        <KPICard 
          title="Spare Value" 
          value={`₹${Number(kpiData.spareValue || 0).toLocaleString('en-IN')}`} 
          icon={Wrench} 
          gradient="bg-emerald-600"
          buttonText="SPARES"
          subtext="Available Inventory"
          trend="up"
          trendValue="8.5"
          onClick={() => router.push("/director-dashboard/spare")}
        />
        <KPICard 
          title="Employee Expenses" 
          value={`₹${Number(kpiData.totalExpensesAll || 0).toLocaleString('en-IN')}`} 
          icon={Users} 
          gradient="bg-indigo-600"
          buttonText="AUDIT"
          subtext="Pending Approvals"
          trend="up"
          trendValue="5.1"
          onClick={() => router.push("/director-dashboard/all-expenses")}
        />
        <KPICard 
          title="Stock Purchase" 
          value={`₹${Number(kpiData.totalStockPurchaseAll || 0).toLocaleString('en-IN')}`} 
          icon={ShoppingCart} 
          gradient="bg-teal-600"
          buttonText="PROCUREMENT"
          subtext="Monthly Inflow"
          trend="up"
          trendValue="15.4"
          onClick={() => router.push("/director-dashboard/purchase/purchases")}
        />
        <KPICard 
          title="Spare Purchase" 
          value={`₹${Number(kpiData.totalSparePurchaseAll || 0).toLocaleString('en-IN')}`} 
          icon={Settings} 
          gradient="bg-purple-600"
          buttonText="LOGS"
          subtext="Monthly Inflow"
          trend="down"
          trendValue="1.8"
          onClick={() => router.push("/director-dashboard/spare/purchase/purchases")}
        />
        <KPICard 
          title="Total Revenue" 
          value={`₹${Number(kpiData.totalSale || 0).toLocaleString('en-IN')}`} 
          icon={DollarSign} 
          gradient="bg-green-600"
          buttonText="FINANCIALS"
          subtext="Gross Monthly"
          trend="up"
          trendValue="22.7"
          onClick={() => router.push("/director-dashboard/purchase/purchases")}
        />
        <KPICard 
          title="Net Profit" 
          value={`₹${Number(kpiData.totalProfit || 0).toLocaleString('en-IN')}`} 
          icon={TrendingUp} 
          gradient="bg-rose-600"
          buttonText="ANALYTICS"
          subtext="Net Earnings"
          trend="up"
          trendValue="18.3"
        />
        <KPICard 
          title="Service Operations" 
          isMultiValue={true}
          multiValues={[
            { label: "DONE", value: kpiData.serviceCompleted },
            { label: "WAIT", value: kpiData.servicePending },
            { label: "SPARES", value: kpiData.servicePendingSpares }
          ]}
          icon={Wrench} 
          gradient="bg-amber-600"
          buttonText="REPORTS"
          buttonOnSide={true}
          onClick={() => router.push("/director-dashboard/view_service_reports")}
        />
      </div>
    </div>
  );
}
