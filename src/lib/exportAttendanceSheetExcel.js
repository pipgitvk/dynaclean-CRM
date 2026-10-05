import ExcelJS from "exceljs";

export async function downloadAttendanceSheetExcel(data) {
  const rows = data?.rows || [];
  const days = data?.days || [];
  if (!rows.length) throw new Error("No rows to export");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance", {
    views: [{ state: "frozen", ySplit: 4, xSplit: 5 }],
  });

  sheet.mergeCells(1, 1, 1, 5 + days.length + 1);
  sheet.getCell(1, 1).value = data.company_name || "DYNACLEAN INDUSTRIES PRIVATE LIMITED";
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.getCell(1, 1).alignment = { horizontal: "center" };

  sheet.mergeCells(2, 1, 2, 5 + days.length + 1);
  sheet.getCell(2, 1).value = data.title || "ATTENDANCE RECORD";
  sheet.getCell(2, 1).font = { bold: true, size: 12 };
  sheet.getCell(2, 1).alignment = { horizontal: "center" };

  sheet.mergeCells(3, 1, 3, 5 + days.length + 1);
  sheet.getCell(3, 1).value = `MONTH: ${data.monthLabel} | ${data.dateFromDisplay} TO ${data.dateToDisplay} | ${data.fiscalYear}`;

  const fixedHeaders = ["S.NO", "NAME", "DOB", "DATE OF JOINING", "DESIGNATION"];
  const dayNums = days.map((d) => d.day);
  const headerRow = sheet.addRow([...fixedHeaders, ...dayNums, "TOTAL PRESENT"]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB3E5FC" },
  };

  sheet.addRow([
    "",
    "",
    "",
    "",
    "",
    ...days.map((d) => d.dow),
    "",
  ]);

  for (const r of rows) {
    sheet.addRow([
      r.sno,
      r.name,
      r.date_of_birth_display || "",
      r.date_of_joining_display || "",
      r.designation || "",
      ...(r.cells || []).map((c) => c.code || ""),
      r.total_present,
    ]);
  }

  sheet.columns = [
    { width: 6 },
    { width: 22 },
    { width: 12 },
    { width: 14 },
    { width: 18 },
    ...days.map(() => ({ width: 4 })),
    { width: 14 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    const m = (data.month || "month").replace(/[^\d-]/g, "");
    a.download = `Attendance_sheet_${m}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
  return rows.length;
}
