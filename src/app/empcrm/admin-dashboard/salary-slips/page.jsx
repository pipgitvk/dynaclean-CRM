"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import {
  generatePayslipPDF,
  downloadPayslip,
  buildTemplatePayslipHTML,
  buildPayslipOptsFromMonthlyRecord,
} from "@/utils/payslipGenerator";
import {
  PayslipRecordsShell,
  PayslipRefreshButton,
  PayslipStatusCell,
  PayslipDownloadButton,
  PayslipViewButton,
  PayslipPreviewModal,
  PAYSLIP_UI,
  formatPayslipCurrency,
  formatPayslipMonth,
  payslipThClass,
  payslipThRightClass,
  payslipTdClass,
  payslipTdRightClass,
  payslipInputClass,
  payslipSecondaryButtonClass,
} from "@/components/empcrm/PayslipRecordsListUI";

export default function AdminSalarySlipsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (month) q.set("month", month);
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/empcrm/salary/all-records?${q.toString()}`);
      const data = await res.json();
      if (res.status === 403) {
        toast.error(data.message || "Not allowed");
        setRecords([]);
        return;
      }
      if (data.success) {
        setRecords(data.salaryRecords || []);
      } else {
        toast.error(data.message || "Failed to load");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load salary slips");
    } finally {
      setLoading(false);
    }
  }, [month, search]);

  useEffect(() => {
    load();
  }, [load]);

  const applySearch = () => {
    setSearch(searchDraft);
  };

  const handleDownload = async (record) => {
    const toastId = toast.loading("Generating payslip…");
    try {
      const pdf = await generatePayslipPDF(record, record);
      const u = record.username || record.full_name || "employee";
      downloadPayslip(pdf, `Payslip_${u}_${record.salary_month}.pdf`);
      toast.success("Downloaded", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Could not generate payslip", { id: toastId });
    }
  };

  const handleView = (record) => {
    const opts = buildPayslipOptsFromMonthlyRecord(record);
    setPreviewHtml(buildTemplatePayslipHTML(opts));
    const u = record.username || record.full_name || "Employee";
    setPreviewTitle(`Payslip — ${u} — ${formatPayslipMonth(record.salary_month)}`);
    setPreviewOpen(true);
  };

  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 flex-1">
          <label className="flex flex-col gap-1 min-w-[11rem] text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Salary month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={payslipInputClass}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[12rem] text-xs font-semibold text-gray-800 uppercase tracking-wide">
            Search
            <div className="flex gap-2">
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                placeholder="Username, emp ID, email…"
                className={payslipInputClass}
              />
              <button
                type="button"
                onClick={applySearch}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-sm font-semibold text-white border border-black ${PAYSLIP_UI.navy} ${PAYSLIP_UI.navyHover}`}
              >
                <Search className="w-4 h-4" />
                Apply
              </button>
            </div>
          </label>
        </div>
        <PayslipRefreshButton onClick={load} loading={loading} />
      </div>
      {(month || search) && (
        <button
          type="button"
          onClick={() => {
            setMonth("");
            setSearch("");
            setSearchDraft("");
          }}
          className={payslipSecondaryButtonClass + " self-start"}
        >
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <>
    <PayslipRecordsShell
      title="Salary slips"
      subtitle="All employees’ monthly records. Filter by month or search by user, employee ID, or email."
      listTitle="Pay slip records"
      toolbar={toolbar}
      listHint={
        !loading && records.length > 0
          ? "Showing up to 200 rows per request. Narrow month or search to find a specific slip."
          : undefined
      }
      loading={loading}
      empty={!loading && records.length === 0}
      emptyMessage="No records match your filters."
    >
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className={PAYSLIP_UI.navy}>
            <th className={payslipThClass}>Employee</th>
            <th className={payslipThClass}>Emp ID</th>
            <th className={payslipThClass}>Month</th>
            <th className={payslipThClass}>Status</th>
            <th className={payslipThRightClass}>Net salary</th>
            <th className={payslipThRightClass}>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={row.id} className="bg-white hover:bg-slate-50/90">
              <td className={`${payslipTdClass} font-medium`}>
                {row.username || row.full_name}
              </td>
              <td className={`${payslipTdClass} tabular-nums text-gray-700`}>{row.empId ?? "—"}</td>
              <td className={payslipTdClass}>{formatPayslipMonth(row.salary_month)}</td>
              <td className={payslipTdClass}>
                <PayslipStatusCell status={row.status} />
              </td>
              <td className={payslipTdRightClass}>{formatPayslipCurrency(row.net_salary)}</td>
              <td className={`${payslipTdRightClass} align-middle`}>
                <div className="flex justify-end flex-wrap gap-2">
                  <PayslipViewButton onClick={() => handleView(row)} />
                  <PayslipDownloadButton onClick={() => handleDownload(row)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PayslipRecordsShell>
    <PayslipPreviewModal
      open={previewOpen}
      title={previewTitle}
      html={previewHtml}
      onClose={() => setPreviewOpen(false)}
    />
    </>
  );
}
