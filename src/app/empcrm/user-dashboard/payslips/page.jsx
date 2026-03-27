"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "@/components/empcrm/PayslipRecordsListUI";

export default function PayslipsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/empcrm/salary?history=all");
      const data = await res.json();
      if (data.success) {
        setRecords(data.salaryRecords || []);
      } else {
        toast.error(data.message || "Failed to load payslips");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (record) => {
    const toastId = toast.loading("Generating payslip…");
    try {
      const pdf = await generatePayslipPDF(record, record);
      downloadPayslip(pdf, `Payslip_${record.salary_month}.pdf`);
      toast.success("Downloaded", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Could not generate payslip", { id: toastId });
    }
  };

  const handleView = (record) => {
    const opts = buildPayslipOptsFromMonthlyRecord(record);
    setPreviewHtml(buildTemplatePayslipHTML(opts));
    setPreviewTitle(`Payslip — ${formatPayslipMonth(record.salary_month)}`);
    setPreviewOpen(true);
  };

  return (
    <>
    <PayslipRecordsShell
      title="My payslips"
      subtitle="Only approved or paid months are shown. Download PDF after HR has approved your salary."
      listTitle="Pay slip records"
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-800">
            Your payroll history — newest months first.
          </p>
          <PayslipRefreshButton onClick={load} loading={loading} />
        </div>
      }
      loading={loading}
      empty={!loading && records.length === 0}
      emptyMessage="No payslips to show yet. Slips appear here only after HR approves your salary for a month (or marks it paid). Draft months stay hidden."
    >
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className={PAYSLIP_UI.navy}>
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
                {formatPayslipMonth(row.salary_month)}
              </td>
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
