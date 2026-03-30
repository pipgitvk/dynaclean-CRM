import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import logo1 from "@/components/logo1.jpg";
import { floorInr } from "@/lib/salaryGrossSpecialAllowance";

const getImportedImageSrc = (mod) => {
  if (!mod) return "";
  if (typeof mod === "string") return mod;
  if (typeof mod === "object" && mod !== null && "src" in mod) return mod.src;
  return "";
};

const PAYSLIP_LOGO_SRC = getImportedImageSrc(logo1);

/** Target ~under 3MB: html2canvas scale + JPEG (PNG was multi‑MB per page). */
const PAYSLIP_CANVAS_MAX_BYTES = 3 * 1024 * 1024;
const PAYSLIP_HTML2CANVAS_SCALE = 2;
const PAYSLIP_PDF_TOP_MARGIN_MM = 8;

function dataUrlByteSize(dataUrl) {
  const i = dataUrl.indexOf(",");
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

/**
 * JPEG encode with stepped quality until under PAYSLIP_CANVAS_MAX_BYTES (~3MB).
 */
function canvasToCompressedJpegDataUrl(canvas) {
  let quality = 0.92;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrlByteSize(dataUrl) > PAYSLIP_CANVAS_MAX_BYTES && quality > 0.5) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrlByteSize(dataUrl) > PAYSLIP_CANVAS_MAX_BYTES) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.5);
  }
  return dataUrl;
}

async function htmlFragmentToPdf(tempContainer) {
  const doc = tempContainer.ownerDocument;
  if (doc.fonts?.ready) {
    try {
      await doc.fonts.ready;
    } catch {
      /* ignore */
    }
  }
  void tempContainer.offsetHeight;
  const capW = Math.ceil(
    Math.max(tempContainer.scrollWidth, tempContainer.offsetWidth, 794),
  );
  const capH = Math.ceil(Math.max(tempContainer.scrollHeight, 1)) + 96;

  const canvas = await html2canvas(tempContainer, {
    scale: PAYSLIP_HTML2CANVAS_SCALE,
    width: capW,
    height: capH,
    windowWidth: capW,
    windowHeight: capH,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc) => {
      const b = clonedDoc.body;
      if (b) {
        b.style.setProperty("-webkit-font-smoothing", "antialiased");
        b.style.setProperty("text-rendering", "geometricPrecision");
      }
    },
  });

  const imgData = canvasToCompressedJpegDataUrl(canvas);
  const pdf = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
    compress: true,
    precision: 16,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let drawW = imgWidth;
  let drawH = imgHeight;
  const availableHeight = Math.max(1, pageHeight - PAYSLIP_PDF_TOP_MARGIN_MM);
  if (drawH > availableHeight) {
    const s = availableHeight / drawH;
    drawW *= s;
    drawH = availableHeight;
  }
  const drawX = (pageWidth - drawW) / 2;
  pdf.addImage(imgData, "JPEG", drawX, PAYSLIP_PDF_TOP_MARGIN_MM, drawW, drawH);
  return pdf;
}

/**
 * Maps monthly_salary_records (+ joined rep/profile fields) to the same opts
 * used by buildTemplatePayslipHTML / Generate Salary download.
 */
export function buildPayslipOptsFromMonthlyRecord(record) {
  const r = record || {};
  const details = Array.isArray(r.deduction_details) ? r.deduction_details : [];

  const isHealthName = (d) =>
    /health|insurance/i.test(String(d.deduction_name || ""));

  const sumDetailsOther = details
    .filter(
      (d) =>
        !["PF", "ESI", "IT", "PT"].includes(d.deduction_code || "") &&
        !isHealthName(d),
    )
    .reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const healthFromDetails = details
    .filter(isHealthName)
    .reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const healthInsurance =
    healthFromDetails > 0
      ? healthFromDetails
      : Math.max(0, (Number(r.other_deductions) || 0) - sumDetailsOther);

  const processedDeductions = [];
  for (const d of details) {
    const code = d.deduction_code || "";
    const name = String(d.deduction_name || "").trim();
    const up = name.toUpperCase();
    const amt = Number(d.amount) || 0;
    if (amt <= 0) continue;
    if (code === "PF" || up.includes("PROVIDENT")) continue;
    if (code === "ESI" || name === "ESI" || /^ESI\b/i.test(name)) continue;
    if (isHealthName(d)) continue;
    processedDeductions.push({
      deduction_name: name || code,
      calculatedAmount: amt,
    });
  }

  const hasItRow = details.some(
    (d) =>
      d.deduction_code === "IT" ||
      /income tax|^tds$/i.test(String(d.deduction_name || "")),
  );
  if (!hasItRow && Number(r.income_tax) > 0) {
    processedDeductions.push({
      deduction_name: "TDS",
      calculatedAmount: Number(r.income_tax),
    });
  }

  const hasPtRow = details.some(
    (d) =>
      d.deduction_code === "PT" ||
      /professional tax/i.test(String(d.deduction_name || "")),
  );
  if (!hasPtRow && Number(r.professional_tax) > 0) {
    processedDeductions.push({
      deduction_name: "Professional Tax",
      calculatedAmount: Number(r.professional_tax),
    });
  }

  const dojRaw =
    r.date_of_joining ?? r.dateOfJoining ?? null;
  let dateOfJoining = "-";
  if (dojRaw != null && dojRaw !== "") {
    const d = dojRaw instanceof Date ? dojRaw : new Date(dojRaw);
    if (!Number.isNaN(d.getTime())) {
      dateOfJoining = d.toLocaleDateString("en-IN");
    }
  }

  const calculation = {
    basicSalary: Number(r.basic_salary) || 0,
    hra: Number(r.hra) || 0,
    transportAllowance: Number(r.transport_allowance) || 0,
    medicalAllowance: Number(r.medical_allowance) || 0,
    specialAllowance: Number(r.special_allowance) || 0,
    bonus: Number(r.bonus) || 0,
    pf: Number(r.pf_deduction) || 0,
    esi: Number(r.esi_deduction) || 0,
    healthInsurance,
    overtimeAmount: Number(r.overtime_amount) || 0,
    totalEarnings: Number(r.total_earnings) || 0,
    totalDeductions: Number(r.total_deductions) || 0,
    netSalary: Number(r.net_salary) || 0,
    processedDeductions,
  };

  return {
    monthStr: r.salary_month,
    employeeName: r.full_name || r.username || "Employee",
    empId: r.empId ?? "-",
    designation: r.userRole || r.userDepartment || r.department || "-",
    bankName: r.bank_name || "-",
    bankAccount: r.bank_account_number || "-",
    pan: r.pan_number || "-",
    dateOfJoining,
    workingDays:
      r.working_days !== undefined && r.working_days !== null
        ? r.working_days
        : "-",
    presentDays:
      r.present_days !== undefined && r.present_days !== null
        ? r.present_days
        : "-",
    overtimeHours:
      r.overtime_hours !== undefined &&
      r.overtime_hours !== null &&
      r.overtime_hours !== ""
        ? Number(r.overtime_hours)
        : 0,
    calculation,
  };
}

export const downloadPayslip = (pdf, filename) => {
  pdf.save(filename || "payslip.pdf");
};

const fmtInr = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const getMonthYearLabel = (monthStr) => {
  if (!monthStr) return "";
  const [y, m] = monthStr.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

/** Defaults — override via NEXT_PUBLIC_PAYSLIP_* in env (client) */
const getCompanyBlock = () => ({
  name: process.env.NEXT_PUBLIC_PAYSLIP_COMPANY_NAME || "Dynaclean Industries Pvt Ltd",
  line1:
    process.env.NEXT_PUBLIC_PAYSLIP_ADDRESS_LINE1 ||
    "1st Floor, 13-B, Kattabomman Street, Gandhi Nagar",
  line2: process.env.NEXT_PUBLIC_PAYSLIP_ADDRESS_LINE2 || "Coimbatore - 641006",
  email: process.env.NEXT_PUBLIC_PAYSLIP_EMAIL || "",
  phone: process.env.NEXT_PUBLIC_PAYSLIP_PHONE || "",
});

/** Same HTML used for PDF export — use for on-screen preview to match download pixel-for-pixel */
export const buildTemplatePayslipHTML = (opts) => {
  const {
    company = getCompanyBlock(),
    monthStr,
    employeeName,
    empId,
    designation,
    bankName,
    bankAccount,
    pan,
    dateOfJoining,
    workingDays,
    presentDays,
    overtimeHours,
    calculation,
  } = opts;

  const c = calculation;
  const EARN_ROW_COUNT = 7;
  const earningsLabels = [
    "Basic Salary",
    "HRA",
    "Transport Allw.",
    "Medical Allw.",
    "Special Allw.",
    "Bonus",
    "Overtime",
  ];
  const earningAmounts = [
    c.basicSalary,
    c.hra,
    c.transportAllowance,
    c.medicalAllowance,
    Number(c.specialAllowance) || 0,
    Number(c.bonus) || 0,
    Number(c.overtimeAmount) || 0,
  ];

  const isPfDeductionRow = (d) => {
    const code = String(d?.deduction_code || "");
    const name = String(d?.deduction_name || "");
    return (
      code === "PF" ||
      name === "PF" ||
      /provident/i.test(name)
    );
  }
  const pfFromBasic = floorInr(0.12 * (Number(c.basicSalary) || 0));
  const structureDeds = [
    { deduction_name: "PF", calculatedAmount: pfFromBasic },
    { deduction_name: "ESI", calculatedAmount: Number(c.esi) || 0 },
    {
      deduction_name: "Health Insurance",
      calculatedAmount: Number(c.healthInsurance) || 0,
    },
  ].filter((d) => Number(d.calculatedAmount) > 0);
  const processedPositive = (Array.isArray(c.processedDeductions)
    ? c.processedDeductions
    : []
  ).filter(
    (d) =>
      Number(d.calculatedAmount) > 0 && !isPfDeductionRow(d),
  );
  const dedList = [...structureDeds, ...processedPositive];
  const ROWS = Math.max(EARN_ROW_COUNT, dedList.length);

  const deductionLabels = [];
  const deductionAmounts = [];
  for (let i = 0; i < ROWS; i++) {
    if (i < dedList.length) {
      deductionLabels.push(dedList[i].deduction_name || "");
      deductionAmounts.push(Number(dedList[i].calculatedAmount) || 0);
    } else {
      deductionLabels.push("");
      deductionAmounts.push(null);
    }
  }

  const salFont =
    'font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:geometricPrecision;';
  const salRow = `${salFont}font-size:14px;font-weight:700;color:#404040;padding:7px 7px;border:1px solid #666;vertical-align:middle;line-height:1.3;`;
  const salAmt = `${salRow}text-align:right;font-variant-numeric:tabular-nums;`;
  const rowsHtml = [];
  for (let i = 0; i < ROWS; i++) {
    const dedLabel = deductionLabels[i] || "";
    const dedAmt = deductionAmounts[i];
    const dedVal =
      dedLabel && dedAmt != null ? fmtInr(dedAmt) : "";
    const earnLabel = i < EARN_ROW_COUNT ? earningsLabels[i] : "";
    const earnShow = i < EARN_ROW_COUNT;
    rowsHtml.push(`<tr>
      <td style="${salRow}text-align:left;">${earnLabel}</td>
      <td style="${salAmt}">${earnShow ? fmtInr(earningAmounts[i]) : ""}</td>
      <td style="${salRow}text-align:left;">${dedLabel}</td>
      <td style="${salAmt}">${dedVal}</td>
    </tr>`);
  }

  const monthLabel = getMonthYearLabel(monthStr);
  const co = company;

  const displayTotalDeductions = dedList.reduce(
    (s, d) => s + (Number(d.calculatedAmount) || 0),
    0,
  );
  const displayNetSalary = Math.max(
    0,
    floorInr((Number(c.totalEarnings) || 0) - displayTotalDeductions),
  );

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Payslip</title></head>
<body style="margin:0;padding:16px;background:#fff;font-family:Georgia,'Times New Roman',serif;font-size:11px;color:#000;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:geometricPrecision;">
<div style="max-width:720px;margin:0 auto;border:3px solid #000;box-sizing:border-box;-webkit-font-smoothing:antialiased;">
  ${
    PAYSLIP_LOGO_SRC
      ? `<div style="text-align:center;padding:16px 12px 8px;background:#fff;">
    <img src="${PAYSLIP_LOGO_SRC}" alt="" crossOrigin="anonymous" style="max-height:80px;max-width:260px;object-fit:contain;display:inline-block;" />
  </div>`
      : ""
  }
  <div style="text-align:center;padding:10px 12px;line-height:1.5;">
    <div style="font-weight:bold;font-size:13px;">${co.name}</div>
    <div>${co.line1}</div>
    <div>${co.line2}</div>
    ${co.email ? `<div>Email: ${co.email}</div>` : ""}
    ${co.phone ? `<div>Contact No: ${co.phone}</div>` : ""}
  </div>
  <div style="background:#1e3a5f;color:#fff;text-align:center;padding:8px;font-weight:bold;">
    PaySlip For The Month Of ${monthLabel}
  </div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;">
    <tr>
      <td style="width:25%;padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Name</td>
      <td style="width:25%;padding:4px 6px;border:1px solid #333;">${employeeName || "-"}</td>
      <td style="width:25%;padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Employee ID</td>
      <td style="width:25%;padding:4px 6px;border:1px solid #333;">${empId || "-"}</td>
    </tr>
    <tr>
      <td style="padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Designation</td>
      <td style="padding:4px 6px;border:1px solid #333;">${designation || "-"}</td>
      <td style="padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Bank Name</td>
      <td style="padding:4px 6px;border:1px solid #333;">${bankName || "-"}</td>
    </tr>
    <tr>
      <td style="padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Bank A/C No.</td>
      <td style="padding:4px 6px;border:1px solid #333;">${bankAccount || "-"}</td>
      <td style="padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Date Of Joining</td>
      <td style="padding:4px 6px;border:1px solid #333;">${dateOfJoining || "-"}</td>
    </tr>
    <tr>
      <td style="padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">PAN No.</td>
      <td style="padding:4px 6px;border:1px solid #333;">${pan || "-"}</td>
      <td style="padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Working Days</td>
      <td style="padding:4px 6px;border:1px solid #333;">${workingDays ?? "-"}</td>
    </tr>
    <tr>
      <td style="padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Present Days</td>
      <td style="padding:4px 6px;border:1px solid #333;">${presentDays ?? "-"}</td>
      <td style="padding:4px 6px;border:1px solid #333;background:#e8f4fc;font-weight:bold;">Overtime Hours</td>
      <td style="padding:4px 6px;border:1px solid #333;">${overtimeHours ?? "-"}</td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #666;table-layout:fixed;${salFont}">
    <tr>
      <td colspan="2" style="border:1px solid #666;background:#1e3a5f;color:#fff;font-weight:700;text-align:center;padding:7px 7px;font-size:15px;">Earnings</td>
      <td colspan="2" style="border:1px solid #666;background:#1e3a5f;color:#fff;font-weight:700;text-align:center;padding:7px 7px;font-size:15px;">Deductions</td>
    </tr>
    <tr>
      <td style="border:1px solid #666;background:#9dc3ee;font-weight:700;padding:7px 7px;font-size:14px;">Salary Head</td>
      <td style="border:1px solid #666;background:#9dc3ee;font-weight:700;padding:7px 7px;font-size:14px;text-align:right;">Amount</td>
      <td style="border:1px solid #666;background:#9dc3ee;font-weight:700;padding:7px 7px;font-size:14px;">Salary Head</td>
      <td style="border:1px solid #666;background:#9dc3ee;font-weight:700;padding:7px 7px;font-size:14px;text-align:right;">Amount</td>
    </tr>
    ${rowsHtml.join("")}
    <tr>
      <td style="border:1px solid #666;background:#a9c4e3;font-weight:700;padding:7px 7px;font-size:14px;">Salary</td>
      <td style="border:1px solid #666;background:#fff;font-weight:700;padding:7px 7px;font-size:14px;text-align:right;">${fmtInr(c.totalEarnings)}</td>
      <td style="border:1px solid #666;background:#a9c4e3;font-weight:700;padding:7px 7px;font-size:14px;">Total Deduction</td>
      <td style="border:1px solid #666;background:#fff;font-weight:700;padding:7px 7px;font-size:14px;text-align:right;">${fmtInr(displayTotalDeductions)}</td>
    </tr>
    <tr>
      <td colspan="4" style="border-left:1px solid #666;border-right:1px solid #666;border-bottom:1px solid #666;padding:8px 6px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td colspan="3" style="border-left:1px solid #666;border-right:none;border-bottom:1px solid #666;padding:8px 9px;font-size:14px;line-height:1.25;font-weight:700;">Net Pay</td>
      <td style="border-left:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:8px 9px;font-size:14px;line-height:1.25;text-align:right;font-weight:700;">${fmtInr(displayNetSalary)}</td>
    </tr>
  </table>
  <div style="padding:24px 16px 32px;text-align:center;font-size:12px;color:#555;line-height:1.5;font-style:italic;">
    This is a computer-generated document and does not require a physical signature.
  </div>
  <div style="height:10px;background:#1e3a5f;"></div>
</div>
</body></html>`;
};

/**
 * Payslip PDF matching the classic blue payslip layout (Generate Salary screen data).
 */
export async function generateGenerateSalaryPayslipPDF(opts) {
  const htmlContent = buildTemplatePayslipHTML(opts);
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = htmlContent;
  tempContainer.style.position = "absolute";
  tempContainer.style.left = "-9999px";
  tempContainer.style.top = "0";
  tempContainer.style.width = "794px";
  document.body.appendChild(tempContainer);

  const images = tempContainer.querySelectorAll("img");
  await Promise.all(
    [...images].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth) return resolve();
          const done = () => resolve();
          img.onload = done;
          img.onerror = done;
        }),
    ),
  );

  const pdf = await htmlFragmentToPdf(tempContainer);
  document.body.removeChild(tempContainer);
  return pdf;
}

/**
 * PDF from stored monthly record (user Salary / Payslips / admin Salary slips).
 * Same HTML as Generate Salary: buildTemplatePayslipHTML + logo + navy layout.
 */
export async function generatePayslipPDF(salaryData, userData) {
  const record = { ...(userData || {}), ...(salaryData || {}) };
  return generateGenerateSalaryPayslipPDF(buildPayslipOptsFromMonthlyRecord(record));
}
