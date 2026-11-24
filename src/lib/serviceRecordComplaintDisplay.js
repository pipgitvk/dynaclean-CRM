import { formatCrmDateOnly } from "@/lib/crmDateFormat";

function isComplaintServiceType(serviceType) {
  return String(serviceType || "")
    .trim()
    .toUpperCase() === "COMPLAINT";
}

function formatServiceRecordDate(raw) {
  if (raw == null || raw === "") return "—";
  const s = String(raw).trim();
  if (!s || s.startsWith("0000-00-00")) return "—";
  return formatCrmDateOnly(s) || s.slice(0, 10) || s;
}

/** Complaint rows: show registration date (reg_date) in Complaint Date column. */
export function displayComplaintDateForServiceRecord(row) {
  const isComplaint = isComplaintServiceType(row?.service_type);
  const raw = isComplaint
    ? row?.reg_date ?? row?.complaint_date
    : row?.complaint_date ?? row?.reg_date;
  return formatServiceRecordDate(raw);
}

/** Reg. Date column — complaints use reg_date in Complaint Date instead. */
export function displayRegDateForServiceRecord(row) {
  if (isComplaintServiceType(row?.service_type)) return "—";
  return formatServiceRecordDate(row?.reg_date);
}