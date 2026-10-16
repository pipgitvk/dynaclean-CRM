"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Box,
  Wrench,
  Users,
  ShoppingCart,
  Settings,
  TrendingUp,
  DollarSign,
  Calendar,
  Sun,
  PackageX,
} from "lucide-react";
import ScheduleVisitCard from "@/components/scheduleVisit/ScheduleVisitCard";

const SimpleCard = ({
  title,
  value,
  icon: Icon,
  borderColor,
  onClick,
  subtext,
  multiValues,
  loading = false,
}) => {
  const getNumericValue = (val) => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const numMatch = val.replace(/,/g, "").match(/\d+/);
      return numMatch ? parseInt(numMatch[0], 10) : 0;
    }
    return 0;
  };

  const numValue = getNumericValue(value);
  const textColor =
    numValue === 0 ? "text-green-600" : "text-red-600";

  return (
    <a
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-3 sm:p-4 text-black hover:shadow-lg transition-shadow h-full cursor-pointer block border-l-4 min-h-[100px] sm:min-h-[120px] flex flex-col ${borderColor}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 sm:w-5 h-4 sm:h-5 shrink-0" />}
        <h2 className="text-xs sm:text-sm font-bold text-black leading-tight uppercase">
          {title}
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 flex-1">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-blue-600" />
        </div>
      ) : multiValues ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-1">
          {multiValues.map((item, idx) => {
            const itemColor =
              item.value === 0 ? "text-green-600" : "text-red-600";
            return (
              <div key={idx} className="text-center">
                <p
                  className={`text-lg sm:text-xl font-bold leading-none ${itemColor}`}
                >
                  {item.value}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-semibold mt-1">
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <p
            className={`text-xl sm:text-2xl font-bold mt-auto ${textColor} line-clamp-2`}
          >
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-gray-600 mt-1">{subtext}</p>
          )}
        </>
      )}
    </a>
  );
};

export default function DirectorDashboard() {
  const router = useRouter();
  const [dateFrom] = useState(
    () => new Date().toISOString().slice(0, 7) + "-01",
  );
  const [dateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [kpiLoading, setKpiLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(true);
  const [lowStockLoading, setLowStockLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [totalAvailableStockPrice, setTotalAvailableStockPrice] = useState(0);
  const [totalAvailableStockQty, setTotalAvailableStockQty] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [regTotal, setRegTotal] = useState(0);
  const [regPending, setRegPending] = useState(0);
  const [leaveTotal, setLeaveTotal] = useState(0);
  const [leavePending, setLeavePending] = useState(0);
  const [kpiData, setKpiData] = useState({
    taskPending: 0,
    spareValue: 0,
    totalExpensesAll: 0,
    totalStockPurchaseAll: 0,
    totalSparePurchaseAll: 0,
    totalSaleAll: 0,
    totalProfit: 0,
    totalProfitAll: 0,
    servicePending: 0,
    serviceCompleted: 0,
    servicePendingSpares: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchKpi = async () => {
      setKpiLoading(true);
      try {
        const res = await fetch(
          `/api/director/dashboard-kpi?from=${dateFrom}&to=${dateTo}`,
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setKpiData(data);
        }
      } catch (e) {
        console.error("KPI fetch:", e);
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
    };

    const fetchStock = async () => {
      setStockLoading(true);
      try {
        const [availableStockRes, purchasePricesRes] = await Promise.all([
          fetch("/api/available-stock"),
          fetch("/api/stock-request"),
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
          return sum + totalQty * pricePerUnit;
        }, 0);
        const totalQty = availableStock.reduce(
          (sum, row) => sum + ((row.delhi || 0) + (row.south || 0)),
          0,
        );
        if (!cancelled) {
          setTotalAvailableStockPrice(total);
          setTotalAvailableStockQty(totalQty);
        }
      } catch (e) {
        console.error("Stock fetch:", e);
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    };

    const fetchLowStock = async () => {
      setLowStockLoading(true);
      try {
        const res = await fetch("/api/stock/low-stock");
        const data = await res.json();
        if (!cancelled) setLowStockCount(data.lowStockCount || 0);
      } catch (e) {
        console.error("Low stock fetch:", e);
      } finally {
        if (!cancelled) setLowStockLoading(false);
      }
    };

    const fetchSummary = async () => {
      setSummaryLoading(true);
      try {
        const res = await fetch("/api/director/dashboard-summary");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRegTotal(data.regTotal ?? 0);
          setRegPending(data.regPending ?? 0);
          setLeaveTotal(data.leaveTotal ?? 0);
          setLeavePending(data.leavePending ?? 0);
        }
      } catch (e) {
        console.error("Summary fetch:", e);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    fetchKpi();
    fetchStock();
    fetchLowStock();
    fetchSummary();

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo]);

  const go = (href) => (e) => {
    e.preventDefault();
    router.push(href);
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700 px-2 sm:px-4 md:px-0 max-w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 px-2 sm:px-0">
        <SimpleCard
          title="Pending Tasks"
          value={kpiData.taskPending}
          icon={ClipboardList}
          borderColor="border-blue-500"
          loading={kpiLoading}
          onClick={go("/director-dashboard/task-manager")}
        />

        <SimpleCard
          title="Available Stock"
          value={`₹${Number(totalAvailableStockPrice || 0).toLocaleString("en-IN")}`}
          icon={Box}
          borderColor="border-green-500"
          subtext={`Qty: ${totalAvailableStockQty.toLocaleString("en-IN")}`}
          loading={stockLoading}
          onClick={go("/director-dashboard/product-stock")}
        />

        <SimpleCard
          title="Low Stock Alerts"
          value={lowStockCount}
          icon={PackageX}
          borderColor="border-red-500"
          loading={lowStockLoading}
          onClick={go("/director-dashboard/product-stock")}
        />

        <SimpleCard
          title="Spare Value"
          value={`₹${Number(kpiData.spareValue || 0).toLocaleString("en-IN")}`}
          icon={Wrench}
          borderColor="border-emerald-500"
          loading={kpiLoading}
          onClick={go("/director-dashboard/spare")}
        />

        <SimpleCard
          title="Employee Expenses"
          value={`₹${Number(kpiData.totalExpensesAll || 0).toLocaleString("en-IN")}`}
          icon={Users}
          borderColor="border-indigo-500"
          loading={kpiLoading}
          onClick={go("/director-dashboard/all-expenses")}
        />

        <SimpleCard
          title="Stock Purchase"
          value={`₹${Number(kpiData.totalStockPurchaseAll || 0).toLocaleString("en-IN")}`}
          icon={ShoppingCart}
          borderColor="border-teal-500"
          loading={kpiLoading}
          onClick={go("/director-dashboard/purchase/purchases")}
        />

        <SimpleCard
          title="Spare Purchase"
          value={`₹${Number(kpiData.totalSparePurchaseAll || 0).toLocaleString("en-IN")}`}
          icon={Settings}
          borderColor="border-purple-500"
          loading={kpiLoading}
          onClick={go("/director-dashboard/spare/purchase/purchases")}
        />

        <SimpleCard
          title="Total Revenue"
          value={`₹${Number(kpiData.totalSaleAll || 0).toLocaleString("en-IN")}`}
          icon={DollarSign}
          borderColor="border-green-600"
          loading={kpiLoading}
          onClick={go("/director-dashboard/total-revenue")}
        />

        <SimpleCard
          title="Net Profit"
          value={`₹${Number(kpiData.totalProfitAll || kpiData.totalProfit || 0).toLocaleString("en-IN")}`}
          icon={TrendingUp}
          borderColor="border-blue-600"
          loading={kpiLoading}
          onClick={go("/director-dashboard")}
        />

        <SimpleCard
          title="Service Operations"
          icon={Wrench}
          borderColor="border-amber-600"
          multiValues={[
            { label: "Done", value: kpiData.serviceCompleted },
            { label: "Wait", value: kpiData.servicePending },
            { label: "Spares", value: kpiData.servicePendingSpares },
          ]}
          loading={kpiLoading}
          onClick={go("/director-dashboard/view_service_reports")}
        />

        <SimpleCard
          title="Attendance"
          value={regPending}
          icon={Calendar}
          borderColor="border-orange-600"
          subtext={`${regTotal} Total`}
          loading={summaryLoading}
          onClick={go("/director-dashboard/attendance-regularization")}
        />

        <SimpleCard
          title="Leave Approvals"
          value={leavePending}
          icon={Sun}
          borderColor="border-yellow-500"
          subtext={`${leaveTotal} Total applications`}
          loading={summaryLoading}
          onClick={go("/director-dashboard/leave")}
        />

        <ScheduleVisitCard
          href="/director-dashboard/schedule-visits"
          alwaysShow
        />
      </div>
    </div>
  );
}
