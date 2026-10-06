import ExcelJS from "exceljs";

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const HEADERS = [
  "Employee Code",
  "Name of Employee",
  "DOJ",
  "Father / Spouse Name",
  "Basic (Rate)",
  "HRA (Rate)",
  "Oth. Allow (Rate)",
  "Total Salary (Rate)",
  "P",
  "HD",
  "A",
  "PL",
  "WO",
  "H",
  "SL",
  "UL",
  "Sun+ (days)",
  "Sun+ (₹)",
  "Hol+ (days)",
  "Hol+ (₹)",
  "Paid Days",
  "Basic (Earned)",
  "HRA (Earned)",
  "Other Allow (Earned)",
  "OT (h)",
  "OT Pay",
  "Incentive",
  "Total (Earned)",
  "PF @ 12%",
  "ESI @ 0.75%",
  "Advance / Deduction",
  "Other Deductions",
  "Net Salary",
];

function rowToExcelCells(r) {
  const att = r.attendance || {};
  const earned = r.earned || {};
  const ded = r.deductions || {};
  return [
    r.employee_code ?? "",
    r.employee_name ?? "",
    r.date_of_joining_display ?? "",
    r.father_or_spouse_name ?? "",
    num(r.rate_basic),
    num(r.rate_hra),
    num(r.rate_other_allow),
    num(r.rate_total),
    num(att.present),
    num(att.half_day),
    num(att.absent),
    num(att.paid_leave),
    num(att.weekly_off),
    num(att.holidays),
    num(att.sick_leave),
    num(att.unpaid_leave),
    num(att.sunday_work_days),
    num(att.sunday_work_pay),
    num(att.holiday_work_days),
    num(att.holiday_work_pay),
    num(att.paid_days),
    num(earned.basic),
    num(earned.hra),
    num(earned.other_allow),
    num(earned.overtime_hours),
    num(earned.overtime_pay),
    num(earned.incentive),
    num(earned.total),
    num(ded.pf),
    num(ded.esi),
    num(ded.advance),
    num(ded.other),
    num(r.net_salary),
  ];
}

/**
 * @param {{ month: string, monthLabel?: string, companyName?: string, rows: object[] }} opts
 */
export async function downloadSalarySheetExcel(opts) {
  const { month, monthLabel, companyName, rows } = opts;
  const list = rows || [];
  if (list.length === 0) {
    throw new Error("No rows to export");
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Salary Sheet", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const title = companyName || "DYNACLEAN INDUSTRIES PRIVATE LIMITED";
  const period = monthLabel || month || "";

  sheet.addRow([title]);
  sheet.addRow([`Salary Sheet — ${period}`]);
  sheet.addRow(HEADERS);

  sheet.mergeCells(1, 1, 1, HEADERS.length);
  sheet.mergeCells(2, 1, 2, HEADERS.length);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(1).alignment = { horizontal: "center" };
  sheet.getRow(2).font = { bold: true, size: 12 };
  sheet.getRow(2).alignment = { horizontal: "center" };

  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE082" },
  };
  headerRow.alignment = { vertical: "middle", wrapText: true };

  for (const r of list) {
    sheet.addRow(rowToExcelCells(r));
  }

  sheet.columns = HEADERS.map((h, i) => ({
    width: i === 1 || i === 3 ? 22 : h.length > 12 ? 14 : 10,
  }));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    const safeMonth = (month || "month").replace(/[^\d-]/g, "");
    a.download = `Salary_sheet_${safeMonth}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }

  return list.length;
}
