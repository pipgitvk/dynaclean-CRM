import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Helper to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

// Helper for date formatting
const formatDate = (dateString) => {
  if (!dateString) return "";
  const dateObj = new Date(dateString);
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getMonthName = (monthStr) => {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
};

const numberToWords = (num) => {
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  // Helper to convert a two-digit number to words
  const convertTwoDigit = (n) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  };

  if ((num = num.toString()).length > 9) return "overflow";
  const n = ("000000000" + num)
    .substr(-9)
    .match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "Invalid number";

  let str = "";
  str += n[1] != 0 ? convertTwoDigit(Number(n[1])) + " Crore " : "";
  str += n[2] != 0 ? convertTwoDigit(Number(n[2])) + " Lakh " : "";
  str += n[3] != 0 ? convertTwoDigit(Number(n[3])) + " Thousand " : "";
  str += n[4] != 0 ? a[Number(n[4])] + " Hundred " : "";
  str +=
    n[5] != 0
      ? (str != "" ? "and " : "") + convertTwoDigit(Number(n[5])) + " "
      : "";

  // Trim and add "Only"
  str = str.trim();
  return str ? str + " Only" : "Zero Only";
};

const generatePayslipHTML = (salaryData, userData) => {
  const {
    salary_month,
    working_days,
    present_days,
    basic_salary,
    hra,
    transport_allowance,
    medical_allowance,
    special_allowance,
    bonus,
    overtime_hours,
    overtime_amount,
    total_earnings,
    pf_deduction,
    esi_deduction,
    income_tax,
    professional_tax,
    other_deductions,
    total_deductions,
    gross_salary,
    net_salary,
    deduction_details,
  } = salaryData;

  const employeeName = userData?.username || salaryData.username || "Employee";
  const role = salaryData.userRole || userData?.userRole || "N/A";
  const department = salaryData.department || userData?.department || "N/A";
  const empId = salaryData.empId || userData?.empId || "-";

  // Placeholders for data not available in checking
  const bankName = userData?.bank_name || "-";
  const accNo = userData?.bank_account_number || "-";
  const uan = userData?.pf_uan || "-";
  const esiNo = userData?.esic_number || "-";
  const pan = userData?.pan_number || "-";
  const gender = userData?.gender || "-";
  const paidDays = present_days; // Assuming paid = present for simple case
  const lopDays = working_days - present_days; // Loss of pay days

  // Earnings
  const standardEarnings = [
    { label: "Basic", amount: basic_salary },
    { label: "HRA", amount: hra },
    { label: "Special Allowance", amount: special_allowance },
    { label: "Transport Allowance", amount: transport_allowance },
    { label: "Medical Allowance", amount: medical_allowance },
  ];

  const otherEarnings = [
    { label: "Incentives", amount: 0 }, // Placeholder
    { label: "Bonus", amount: bonus },
    { label: "Over Time Pay", amount: overtime_amount },
  ];

  // Deductions
  let deductionsList = [];
  if (deduction_details && deduction_details.length > 0) {
    deductionsList = deduction_details.map((d) => ({
      label: d.deduction_name,
      amount: d.amount,
    }));
  } else {
    if (pf_deduction > 0)
      deductionsList.push({ label: "Provident Fund", amount: pf_deduction });
    if (esi_deduction > 0)
      deductionsList.push({ label: "ESI", amount: esi_deduction });
    if (professional_tax > 0)
      deductionsList.push({
        label: "Professional Tax",
        amount: professional_tax,
      });
    if (income_tax > 0)
      deductionsList.push({ label: "TDS", amount: income_tax });
    if (other_deductions > 0)
      deductionsList.push({
        label: "Other Deduction",
        amount: other_deductions,
      });
  }

  // Amount in words
  const amountInWords = numberToWords(Math.round(net_salary)); // Using the helper
  // const amountInWords = formatCurrency(net_salary) + " only"; // Fallback to avoid complexity bugs for now

  // To match the image rows, we iterate up to max length
  const maxRows = Math.max(
    standardEarnings.length + otherEarnings.length + 3,
    deductionsList.length + 3,
  );

  // We will build the table structure carefully in HTML instead of dynamic iterating rows to match the reference exactly
  // Reference has "Earnings", "Amount", "Deductions", "Amount"
  // Then "Gross Salary" row on left side
  // Then "Other Earnings" section header?

  // Let's construct two separate HTML strings for columns

  let earningsHTML = "";
  standardEarnings.forEach((e) => {
    earningsHTML += `<tr><td>${e.label}</td><td class="text-right">${formatCurrency(e.amount)}</td></tr>`;
  });
  // Gross Salary Row (Visual only in the column?)
  earningsHTML += `<tr class="font-bold"><td>Gross Salary</td><td class="text-right">${formatCurrency(total_earnings - bonus - overtime_amount)}</td></tr>`;

  earningsHTML += `<tr><td colspan="2" class="font-bold pt-2">Other Earnings</td></tr>`;
  otherEarnings.forEach((e) => {
    earningsHTML += `<tr><td>${e.label}</td><td class="text-right">${e.amount ? formatCurrency(e.amount) : "-"}</td></tr>`;
  });

  let deductionsHTML = "";
  deductionsList.forEach((d) => {
    deductionsHTML += `<tr><td>${d.label}</td><td class="text-right">${formatCurrency(d.amount)}</td></tr>`;
  });

  // Fill remaining height? Not easily doable in HTML string without fixed height.
  // We will just let them flow naturally side-by-side.

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Payslip</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #000; background: #fff; font-size: 13px; }
            .container { max-width: 900px; margin: 0 auto; border: 1px solid #333; }
            
            /* Header */
            .header-row { display: flex; border-bottom: 2px solid #333; }
            .logo-section { width: 30%; background: #fff; display: flex; align-items: center; justify-content: center; padding: 10px; border-right: 1px solid #333; }
            .company-section { width: 70%; background: #b91c1c; color: white; padding: 20px; text-align: center; } 
            
            .logo { max-width: 150px; }
            .company-name { font-size: 22px; font-weight: bold; margin: 0; text-transform: uppercase; }
            .company-address { font-size: 14px; margin-top: 5px; }
            
            /* Title Bar */
            .title-bar { background: #e5e7eb; padding: 5px; text-align: center; font-weight: bold; border-bottom: 1px solid #333; border-top: 1px solid #333; }
            
            /* Employee Grid */
            .emp-grid { display: flex; width: 100%; border-bottom: 1px solid #333; }
            .emp-col { width: 33.33%; padding: 10px; border-right: 1px solid #333; }
            .emp-col:last-child { border-right: none; }
            
            .emp-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .label { font-weight: bold; width: 45%; }
            .value { width: 55%; }
            
            /* Financials */
            .financials-container { display: flex; width: 100%; }
            .fin-col { width: 50%; border-right: 1px solid #333; }
            .fin-col:last-child { border-right: none; }
            
            .fin-table { width: 100%; border-collapse: collapse; }
            .fin-table th { text-align: left; padding: 5px 10px; font-weight: bold; border-bottom: 1px solid #333; }
            .fin-table td { padding: 5px 10px; }
            
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .pt-2 { padding-top: 10px; }
            
            /* Totals */
            .totals-row { display: flex; border-top: 1px solid #333; border-bottom: 1px solid #333; font-weight: bold; }
            .total-cell { width: 50%; padding: 8px 10px; display: flex; justify-content: space-between; }
            .total-cell:first-child { border-right: 1px solid #333; }
            
            .net-pay-row { padding: 10px; font-weight: bold; border-bottom: 1px solid #333; display: flex; justify-content: space-between; font-size: 15px; }
            .words-row { padding: 10px; font-style: italic; font-size: 14px; border-bottom: 1px solid #333;}
            
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header-row">
                 <div class="logo-section">
                    <img src="/images/logo.png" alt="Logo" class="logo" onerror="this.style.display='none'">
                 </div>
                 <div class="company-section">
                    <div class="company-name">DYNACLEAN INDUSTRIES PVT LTD</div>
                    <div class="company-address">1st Floor, 13-B, Kattabomman Street, Gandhi Nagar, Coimbatore - 641006</div>
                 </div>
            </div>
            
            <div class="title-bar">
                Payslip For the Month of ${getMonthName(salary_month)}
            </div>
            
            <div class="emp-grid">
                <div class="emp-col">
                    <div class="emp-row"><span class="label">Employee ID:</span> <span class="value">${empId}</span></div>
                    <div class="emp-row"><span class="label">Employee Name:</span> <span class="value">${employeeName}</span></div>
                    <div class="emp-row"><span class="label">Department:</span> <span class="value">${department}</span></div>
                    <div class="emp-row"><span class="label">Designation:</span> <span class="value">${role}</span></div>
                    <div class="emp-row"><span class="label">Gender:</span> <span class="value">${gender}</span></div>
                </div>
                <div class="emp-col">
                    <div class="emp-row"><span class="label">Bank Name:</span> <span class="value">${bankName}</span></div>
                    <div class="emp-row"><span class="label">A/C #:</span> <span class="value">${accNo}</span></div>
                    <div class="emp-row"><span class="label">UAN #:</span> <span class="value">${uan}</span></div>
                    <div class="emp-row"><span class="label">ESI #:</span> <span class="value">${esiNo}</span></div>
                    <div class="emp-row"><span class="label">PAN #:</span> <span class="value">${pan}</span></div>
                </div>
                <div class="emp-col">
                    <div class="emp-row"><span class="label">Paid Days:</span> <span class="value">${paidDays}</span></div>
                    <div class="emp-row"><span class="label">LOP Days:</span> <span class="value">${lopDays}</span></div>
                    <div class="emp-row"><span class="label">Days in Month:</span> <span class="value">${working_days}</span></div>
                </div>
            </div>
            
            <div class="financials-container">
                <div class="fin-col">
                    <table class="fin-table">
                        <thead>
                            <tr>
                                <th>Earnings</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${earningsHTML}
                        </tbody>
                    </table>
                </div>
                <div class="fin-col">
                    <table class="fin-table">
                        <thead>
                            <tr>
                                <th>Deductions</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${deductionsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="totals-row">
                 <div class="total-cell">
                    <span>Total Earnings</span>
                    <span>${formatCurrency(total_earnings)}</span>
                 </div>
                 <div class="total-cell">
                    <span>Total Deductions</span>
                    <span>${formatCurrency(total_deductions)}</span>
                 </div>
            </div>
            
            <div class="net-pay-row">
                <span>Net Pay</span>
                <span>${formatCurrency(net_salary)}</span>
            </div>
            
            <div class="words-row">
                ${amountInWords}
            </div>
            
        </div>
    </body>
    </html>
    `;
};

export const generatePayslipPDF = async (salaryData, userData) => {
  try {
    const htmlContent = generatePayslipHTML(salaryData, userData);

    // Create container
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = htmlContent;
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.style.top = "0";
    tempContainer.style.width = "794px"; // A4 width
    document.body.appendChild(tempContainer);

    const canvas = await html2canvas(tempContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    document.body.removeChild(tempContainer);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

    return pdf;
  } catch (error) {
    console.error("Error generating Payslip PDF:", error);
    throw error;
  }
};

export const downloadPayslip = (pdf, filename) => {
  pdf.save(filename || "payslip.pdf");
};
