"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Calculator, AlertCircle, Download, CalendarDays } from "lucide-react";
import toast from "react-hot-toast";
import {
  generateGenerateSalaryPayslipPDF,
  downloadPayslip,
  buildTemplatePayslipHTML,
} from "@/utils/payslipGenerator";
import {
  computeSpecialAllowanceFromGross,
  computeBasicHraFromGrossSalary,
  floorInr,
  getEffectiveGrossSalary,
  applyStatutoryDeductionsFromStructure,
  isHealthInsuranceDeductionRow,
} from "@/lib/salaryGrossSpecialAllowance";

function formatPayCalcNumber(n) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    const x = Number(n);
    return x % 1 === 0 ? String(x) : x.toFixed(1);
}

/** Payroll-only rows when API has no `attendance_cards` (same shape as older salary summary). */
function payrollAttendanceFallbackRows(b) {
    return {
        fullDayPresent: b.present,
        halfDays: b.halfDay,
        sundayOff: b.weekendOff,
        holidayN: b.holiday,
        paidLeaveN: b.paidLeave,
        lopN: b.lop,
    };
}

const GenerateSalaryPage = () => {
    const router = useRouter();

    // Selection State
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedEmployee, setSelectedEmployee] = useState("");
    const [employees, setEmployees] = useState([]);

    // Data State
    const [loading, setLoading] = useState(false);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const [salaryStructure, setSalaryStructure] = useState(null);
    const [deductions, setDeductions] = useState([]);

    /** Dates employee had a log on Sunday (worked on Sunday). */
    const [sundaysWorked, setSundaysWorked] = useState([]);
    /** Breakdown from attendance-summary API for the selected month. */
    const [attendanceBreakdown, setAttendanceBreakdown] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        working_days: 30,
        present_days: 0,
        overtime_hours: 0,
        status: 'draft'
    });

    // Calculated State
    const [calculation, setCalculation] = useState(null);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    /** Same opts as PDF — drives WYSIWYG preview */
    const [payslipPreviewOpts, setPayslipPreviewOpts] = useState(null);

    // Fetch Employees on Mount
    useEffect(() => {
        fetchEmployees();
    }, []);

    // Fetch Employee Details when selection changes
    useEffect(() => {
        if (selectedEmployee && selectedMonth) {
            fetchEmployeeDetails();
        } else {
            setSalaryStructure(null);
            setDeductions([]);
            setCalculation(null);
            setSundaysWorked([]);
            setAttendanceBreakdown(null);
        }
    }, [selectedEmployee, selectedMonth]);

    // Recalculate whenever form data or structure changes
    useEffect(() => {
        if (salaryStructure) {
            calculateSalary();
        }
    }, [formData, salaryStructure, deductions]);

    const fetchEmployees = async () => {
        try {
            const response = await fetch("/api/empcrm/employees");
            const data = await response.json();
            if (data.success) {
                setEmployees(data.employees || []);
            }
        } catch (error) {
            console.error("Error fetching employees:", error);
            toast.error("Failed to fetch employee list");
        }
    };

    const fetchEmployeeDetails = async () => {
        setFetchingDetails(true);
        const apiUser = encodeURIComponent(selectedEmployee);
        const apiMonth = encodeURIComponent(selectedMonth);
        try {
            const [salaryRes, attendanceRes] = await Promise.all([
                fetch(`/api/empcrm/salary?username=${apiUser}&month=${apiMonth}`),
                fetch(`/api/empcrm/salary/attendance-summary?month=${apiMonth}&username=${apiUser}`),
            ]);

            const salaryData = await salaryRes.json().catch(() => ({}));
            const attendanceData = await attendanceRes.json().catch(() => ({}));

            if (salaryRes.ok && salaryData.success) {
                setSalaryStructure(salaryData.salaryStructure ?? null);
                setDeductions(salaryData.deductions || []);
            } else {
                setSalaryStructure(salaryData.salaryStructure ?? null);
                setDeductions(salaryData.deductions || []);
                if (!salaryRes.ok && salaryData?.message) {
                    toast.error(salaryData.message);
                }
            }

            /** null = no attendance row; number = pay days (period − max(0, required working − (full present + half/2))) */
            let payDaysFromAttendance = null;
            let sundayDates = [];

            if (attendanceRes.ok && attendanceData.success && Array.isArray(attendanceData.employees)) {
                const empAtt =
                    attendanceData.employees.length === 1
                        ? attendanceData.employees[0]
                        : attendanceData.employees.find(
                              (e) =>
                                  e.username === selectedEmployee ||
                                  String(e.username ?? "").toLowerCase() ===
                                      String(selectedEmployee ?? "").toLowerCase()
                          );
                if (empAtt) {
                    const pay = empAtt.pay_days != null ? Number(empAtt.pay_days) : NaN;
                    payDaysFromAttendance = Number.isFinite(pay) ? pay : null;
                    if (empAtt.sunday_worked_dates && Array.isArray(empAtt.sunday_worked_dates)) {
                        sundayDates = empAtt.sunday_worked_dates;
                    } else if (empAtt.dates_worked && Array.isArray(empAtt.dates_worked)) {
                        sundayDates = empAtt.dates_worked.filter((dateStr) => {
                            const date = new Date(dateStr);
                            return date.getDay() === 0;
                        });
                    }
                    setAttendanceBreakdown({
                        month: selectedMonth,
                        cards: empAtt.attendance_cards || null,
                        present: Number(empAtt.present_days) || 0,
                        halfDay: Number(empAtt.half_day_count) || 0,
                        weekendOff: Number(empAtt.weekend_off_count) || 0,
                        holiday: Number(empAtt.holiday_count) || 0,
                        lop: Number(empAtt.lop_count) || 0,
                        paidLeave: Number(empAtt.paid_leave_days) || 0,
                        payDays: Number(empAtt.pay_days) || 0,
                        payCalc:
                            empAtt.pay_period_days != null &&
                            empAtt.pay_period_days !== ""
                                ? {
                                      periodDays: Number(empAtt.pay_period_days),
                                      sundaysInPeriod: Number(empAtt.pay_sundays_in_period) || 0,
                                      holidayWeekdaysInPeriod:
                                          Number(empAtt.pay_holiday_weekdays_in_period) || 0,
                                      requiredWorkingDays:
                                          Number(empAtt.pay_required_working_days) || 0,
                                      totalAttendance: Number(empAtt.pay_total_attendance) || 0,
                                      deductionDays: Number(empAtt.pay_deduction_days) || 0,
                                      salaryFullDays: Number(empAtt.present_days) || 0,
                                      salaryHalfDays: Number(empAtt.half_day_count) || 0,
                                  }
                                : null,
                    });
                } else {
                    setAttendanceBreakdown(null);
                }
            } else {
                setAttendanceBreakdown(null);
                if (!attendanceRes.ok && attendanceData?.message) {
                    toast.error(attendanceData.message);
                }
            }

            setSundaysWorked(sundayDates);

            const existingRecord =
                salaryRes.ok && salaryData.success
                    ? salaryData.salaryRecords?.find((r) => r.salary_month === selectedMonth)
                    : null;

            if (existingRecord) {
                setFormData({
                    working_days: existingRecord.working_days,
                    present_days:
                        payDaysFromAttendance !== null
                            ? payDaysFromAttendance
                            : existingRecord.present_days,
                    overtime_hours: existingRecord.overtime_hours,
                    status: existingRecord.status || "draft",
                });
                toast.success("Loaded existing draft/record for this month");
            } else {
                setFormData((prev) => ({
                    ...prev,
                    present_days: payDaysFromAttendance ?? 0,
                    status: "draft",
                }));
            }
        } catch (error) {
            console.error("Error fetching details:", error);
            toast.error("Failed to fetch employee salary details");
        } finally {
            setFetchingDetails(false);
        }
    };

    const calculateSalary = () => {
        if (!salaryStructure) return;

        const { working_days, present_days, overtime_hours } = formData;

        // Basic Calcs
        const workingDays = Number(working_days) || 30;
        const presentDays = Number(present_days) || 0;
        const overtimeHours = Number(overtime_hours) || 0;

        const structBasic = Number(salaryStructure.basic_salary) || 0;
        const structHra = Number(salaryStructure.hra) || 0;
        const structTransport = Number(salaryStructure.transport_allowance) || 0;
        const structMedical = Number(salaryStructure.medical_allowance) || 0;
        const structSpecial = Number(salaryStructure.special_allowance) || 0;
        const structBonus = Number(salaryStructure.bonus) || 0;
        const structPf = Number(salaryStructure.pf) || 0;
        const structEsi = Number(salaryStructure.esi) || 0;
        const structHealthInsurance = Number(salaryStructure.health_insurance) || 0;
        const structOvertimeRate = Number(salaryStructure.overtime_rate) || 0;

        const effectiveGross = getEffectiveGrossSalary(salaryStructure);
        const hasGross = effectiveGross != null && effectiveGross > 0;

        let basicSalary;
        let hra;
        if (hasGross) {
          const bh = computeBasicHraFromGrossSalary({
            grossSalary: effectiveGross,
            workingDays,
            presentDays,
          });
          basicSalary = bh.basicSalary;
          hra = bh.hra;
        } else {
          basicSalary = floorInr((structBasic * presentDays) / workingDays);
          hra =
            structBasic > 0
              ? floorInr((structHra / structBasic) * basicSalary)
              : 0;
        }

        const transportAllowance = floorInr(structTransport);
        const medicalAllowance = floorInr(structMedical);
        const specialAllowance = computeSpecialAllowanceFromGross({
          grossSalary: hasGross ? effectiveGross : null,
          workingDays: workingDays,
          presentDays: presentDays,
          basicSalary,
          hra,
          transportAllowance,
          medicalAllowance,
          fallbackStructureSpecial: structSpecial,
        });
        const bonus = floorInr(structBonus);
        const overtimeAmount = floorInr(overtimeHours * structOvertimeRate);

        const totalEarnings =
            basicSalary +
            hra +
            transportAllowance +
            medicalAllowance +
            specialAllowance +
            bonus +
            overtimeAmount;

        const {
            pf,
            esi,
            healthInsurance,
            lowGrossPfRule,
        } = applyStatutoryDeductionsFromStructure({
            effectiveGross,
            structPf,
            structEsi,
            structHealthInsurance,
            basicSalary,
            totalEarnings,
        });

        // Deductions (only when PF/ESI/Health set in structure; see applyStatutoryDeductionsFromStructure)
        let totalDeductions = pf + esi + healthInsurance;
        const processedDeductions = deductions.map(deduction => {
            let amount = 0;
            const code = deduction.deduction_code;
            const name = deduction.deduction_name;

            const isPF = code === 'PF' || name === 'PF' || name.includes('Provident Fund');
            const isESI = code === 'ESI' || name === 'ESI' || name.includes('ESI');
            const isIT = code === 'IT' || name === 'IT' || name.includes('Income Tax');
            const isPT = code === 'PT' || name === 'PT' || name.includes('Professional Tax');

            if (isPF) {
                return { ...deduction, calculatedAmount: 0 };
            }

            if (lowGrossPfRule && isHealthInsuranceDeductionRow(deduction)) {
                return { ...deduction, calculatedAmount: 0 };
            }

            if (isESI && structEsi <= 0) {
                return { ...deduction, calculatedAmount: 0 };
            }

            if (deduction.calculation_type === 'fixed' || (Number(deduction.amount) > 0 && !deduction.percentage && deduction.calculation_type !== 'formula')) {
                amount = Number(deduction.amount);
            } else if (deduction.calculation_type === 'percentage' && Number(deduction.percentage) > 0) {
                amount = (Number(deduction.percentage) / 100) * totalEarnings;
            } else {
                if (isESI) {
                    amount = 0.0075 * totalEarnings;
                } else if (isIT) {
                    const annualIncome = totalEarnings * 12;
                    if (annualIncome > 250000) {
                        amount = ((annualIncome - 250000) * 0.1) / 12;
                    } else {
                        amount = 0;
                    }
                } else if (isPT) {
                    amount = 200;
                } else {
                    amount = Number(deduction.amount) || 0;
                }
            }

            if (structEsi > 0 && isESI) amount = 0;

            totalDeductions += amount;
            return { ...deduction, calculatedAmount: amount };
        });

        const structureDeductions = [
            ...(pf > 0
                ? [
                      {
                          deduction_name: 'PF',
                          calculatedAmount: pf,
                          _fromStructure: true,
                      },
                  ]
                : []),
            ...(esi > 0
                ? [
                      {
                          deduction_name: 'ESI',
                          calculatedAmount: esi,
                          _fromStructure: true,
                      },
                  ]
                : []),
            ...(healthInsurance > 0
                ? [
                      {
                          deduction_name: 'Health Insurance',
                          calculatedAmount: healthInsurance,
                          _fromStructure: true,
                      },
                  ]
                : []),
        ];

        const netSalary = totalEarnings - totalDeductions;

        setCalculation({
            basicSalary,
            hra,
            transportAllowance,
            medicalAllowance,
            specialAllowance,
            bonus,
            pf,
            esi,
            healthInsurance,
            overtimeAmount,
            totalEarnings,
            structureDeductions,
            processedDeductions,
            totalDeductions,
            netSalary,
            lowGrossPfRule,
        });
    };

    const fetchPayslipOpts = useCallback(async () => {
        if (!calculation || !selectedEmployee) return null;
        let profile = null;
        try {
            const pres = await fetch(
                `/api/empcrm/profile?username=${encodeURIComponent(selectedEmployee)}`
            );
            const pdata = await pres.json();
            if (pdata.success && pdata.profile) profile = pdata.profile;
        } catch {
            /* ignore */
        }
        const emp = employees.find((e) => e.username === selectedEmployee);
        const employeeName =
            profile?.full_name || emp?.full_name || emp?.username || selectedEmployee;
        const dojRaw =
            emp?.date_of_joining || profile?.date_of_joining || null;
        const dateOfJoining = dojRaw
            ? new Date(dojRaw).toLocaleDateString("en-IN")
            : "-";
        const bankNameFromProfile =
            profile?.bank_name ||
            profile?.bankName ||
            profile?.name_as_per_bank ||
            "-";
        const bankAccountFromProfile =
            profile?.bank_account_number ||
            profile?.account_number ||
            profile?.bank_account ||
            profile?.bankAccountNumber ||
            "-";
        const panFromProfile =
            profile?.pan_number ||
            profile?.pan_no ||
            profile?.pan ||
            profile?.panNumber ||
            "-";

        return {
            monthStr: selectedMonth,
            employeeName,
            empId:
                profile?.empId ||
                profile?.employee_code ||
                emp?.empId ||
                "-",
            designation: profile?.designation || emp?.userRole || "-",
            bankName: bankNameFromProfile,
            bankAccount: bankAccountFromProfile,
            pan: panFromProfile,
            dateOfJoining,
            workingDays: formData.working_days,
            presentDays: formData.present_days,
            overtimeHours: formData.overtime_hours,
            calculation,
        };
    }, [
        calculation,
        selectedEmployee,
        selectedMonth,
        formData.working_days,
        formData.present_days,
        formData.overtime_hours,
        employees,
    ]);

    useEffect(() => {
        if (!calculation || !selectedEmployee) {
            setPayslipPreviewOpts(null);
            return;
        }
        let cancelled = false;
        (async () => {
            const o = await fetchPayslipOpts();
            if (!cancelled) setPayslipPreviewOpts(o);
        })();
        return () => {
            cancelled = true;
        };
    }, [calculation, selectedEmployee, fetchPayslipOpts]);

    const payslipPreviewHtml = useMemo(() => {
        if (!payslipPreviewOpts) return null;
        return buildTemplatePayslipHTML(payslipPreviewOpts);
    }, [payslipPreviewOpts]);

    const handleSave = async () => {
        if (!selectedEmployee || !selectedMonth) return;

        setLoading(true);
        try {
            const payload = {
                username: selectedEmployee,
                salary_month: selectedMonth,
                ...formData
            };

            const response = await fetch("/api/empcrm/salary/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                toast.success("Salary saved successfully!");
                router.push("/empcrm/admin-dashboard/salary");
            } else {
                toast.error(data.message || "Failed to save salary");
            }
        } catch (error) {
            console.error("Error saving salary:", error);
            toast.error("An error occurred while saving");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadSalary = async () => {
        if (!calculation || !selectedEmployee) {
            toast.error("Select an employee and wait for salary calculation.");
            return;
        }
        setDownloadingPdf(true);
        try {
            const opts =
                payslipPreviewOpts ?? (await fetchPayslipOpts());
            if (!opts) {
                toast.error("Could not build payslip data.");
                return;
            }

            const pdf = await generateGenerateSalaryPayslipPDF(opts);

            const safe = String(opts.employeeName || selectedEmployee)
                .replace(/[^\w\s-]/g, "")
                .trim()
                .slice(0, 48)
                .replace(/\s+/g, "_");
            downloadPayslip(pdf, `Salary_${safe}_${selectedMonth}.pdf`);
            toast.success("Salary slip downloaded");
        } catch (err) {
            console.error(err);
            toast.error("Could not generate salary slip");
        } finally {
            setDownloadingPdf(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };

    const formatMonthHeading = (ym) => {
        if (!ym || String(ym).length < 7) return ym || "";
        const [y, mo] = String(ym).split("-").map(Number);
        if (!y || !mo) return ym;
        return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
        });
    };

    return (
        <div className="container mx-auto p-4 max-w-5xl">
            <div className="flex items-center mb-6">
                <button
                    onClick={() => router.back()}
                    className="mr-4 p-2 hover:bg-gray-100 rounded-full"
                >
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Generate Salary</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Controls + attendance card */}
                <div className="lg:col-span-1 space-y-4 h-fit">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuration</h2>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        >
                            <option value="">Select Employee...</option>
                            {employees.map(emp => (
                                <option key={emp.empId || emp.username} value={emp.username}>
                                    {emp.username} {emp.full_name ? `- ${emp.full_name}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {salaryStructure ? (
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Working Days</label>
                                <input
                                    type="number"
                                    value={formData.working_days}
                                    onChange={(e) => setFormData({ ...formData, working_days: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Present Days</label>
                                <input
                                    type="number"
                                    value={formData.present_days}
                                    onChange={(e) => setFormData({ ...formData, present_days: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Hours</label>
                                <input
                                    type="number"
                                    value={formData.overtime_hours}
                                    onChange={(e) => setFormData({ ...formData, overtime_hours: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="pending">Pending Approval</option>
                                    <option value="approved">Approved</option>
                                    <option value="paid">Paid</option>
                                </select>
                            </div>

                            {/* Sundays Worked Display */}
                            {sundaysWorked.length > 0 && (
                                <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                                    <p className="text-sm font-semibold text-yellow-800">
                                        Worked on {sundaysWorked.length} Sunday{sundaysWorked.length > 1 ? 's' : ''}:
                                    </p>
                                    <ul className="text-xs text-yellow-700 list-disc list-inside mt-1">
                                        {sundaysWorked.map((date, i) => (
                                            <li key={i}>{formatDate(date)}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : selectedEmployee ? (
                        <div className="text-center py-4 text-gray-500">
                            {fetchingDetails ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
                            ) : (
                                <p className="flex items-center justify-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Structure not found
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>

                {attendanceBreakdown && selectedEmployee && (
                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-lg shadow-md p-5 border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-purple-600 shrink-0" />
                            <span>
                                Monthly attendance — {formatMonthHeading(attendanceBreakdown.month)}
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 mb-3">
                            {attendanceBreakdown.cards
                                ? "Same metrics as Attendance details (admin) for this month — through today if current month."
                                : "Breakdown for the selected employee and month (from attendance records)."}
                        </p>
                        {attendanceBreakdown.payCalc && (
                            <div className="mb-4 rounded-lg border border-purple-100 bg-purple-50/60 p-3 text-xs text-slate-700">
                                <p className="font-semibold text-slate-900 mb-2">
                                    Salary pay days calculation
                                </p>
                                <ul className="space-y-1.5 list-none">
                                    <li>
                                        Period days (eligible in month) ={" "}
                                        <span className="font-semibold tabular-nums">
                                            {formatPayCalcNumber(attendanceBreakdown.payCalc.periodDays)}
                                        </span>
                                    </li>
                                    <li>
                                        Sundays (in period) ={" "}
                                        <span className="font-semibold tabular-nums">
                                            {formatPayCalcNumber(attendanceBreakdown.payCalc.sundaysInPeriod)}
                                        </span>
                                    </li>
                                    <li>
                                        Holidays on weekdays (in period) ={" "}
                                        <span className="font-semibold tabular-nums">
                                            {formatPayCalcNumber(
                                                attendanceBreakdown.payCalc.holidayWeekdaysInPeriod
                                            )}
                                        </span>
                                    </li>
                                    <li>
                                        Required working days = period − Sundays − weekday holidays ={" "}
                                        {formatPayCalcNumber(attendanceBreakdown.payCalc.periodDays)} −{" "}
                                        {formatPayCalcNumber(attendanceBreakdown.payCalc.sundaysInPeriod)} −{" "}
                                        {formatPayCalcNumber(
                                            attendanceBreakdown.payCalc.holidayWeekdaysInPeriod
                                        )}{" "}
                                        ={" "}
                                        <span className="font-semibold text-purple-800 tabular-nums">
                                            {formatPayCalcNumber(
                                                attendanceBreakdown.payCalc.requiredWorkingDays
                                            )}
                                        </span>
                                    </li>
                                    <li>
                                        Total attendance (salary rules) = full days + (half days ÷ 2) ={" "}
                                        {formatPayCalcNumber(attendanceBreakdown.payCalc.salaryFullDays)}{" "}
                                        + ({formatPayCalcNumber(attendanceBreakdown.payCalc.salaryHalfDays)}{" "}
                                        ÷ 2) ={" "}
                                        <span className="font-semibold text-purple-800 tabular-nums">
                                            {formatPayCalcNumber(
                                                attendanceBreakdown.payCalc.totalAttendance
                                            )}
                                        </span>
                                    </li>
                                    <li>
                                        Deduction days = max(0, required − total attendance) ={" "}
                                        <span className="font-semibold tabular-nums">
                                            {formatPayCalcNumber(
                                                attendanceBreakdown.payCalc.deductionDays
                                            )}
                                        </span>
                                    </li>
                                    <li className="pt-1 border-t border-purple-200/80 text-slate-800">
                                        Pay days (for salary) = period − deduction ={" "}
                                        <span className="font-semibold tabular-nums">
                                            {formatPayCalcNumber(attendanceBreakdown.payCalc.periodDays)}
                                        </span>{" "}
                                        −{" "}
                                        <span className="font-semibold tabular-nums">
                                            {formatPayCalcNumber(
                                                attendanceBreakdown.payCalc.deductionDays
                                            )}
                                        </span>{" "}
                                        ={" "}
                                        <span className="font-bold text-purple-800 tabular-nums">
                                            {formatPayCalcNumber(attendanceBreakdown.payDays)}
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        )}
                        <dl className="grid grid-cols-1 gap-2 text-sm">
                            {(() => {
                                const c = attendanceBreakdown.cards;
                                if (c) {
                                    const lateDaysAdjusted = Math.max(
                                        0,
                                        (Number(c.lateDays) || 0) - (Number(c.halfDays) || 0)
                                    );
                                    const presentRegular = Math.max(
                                        0,
                                        (Number(c.present) || 0) - (Number(c.halfDays) || 0)
                                    );
                                    return (
                                        <>
                                            <div className="border-b border-slate-100 py-1.5">
                                                <div className="flex justify-between gap-2">
                                                    <dt className="text-slate-600">Present</dt>
                                                    <dd className="font-semibold text-green-600 tabular-nums">
                                                        {c.present}
                                                    </dd>
                                                </div>
                                                <div className="mt-1.5 space-y-1 pl-4 text-xs">
                                                    <div className="flex justify-between gap-2 text-slate-500">
                                                        <span>Regular </span>
                                                        <span className="tabular-nums font-medium text-slate-700">
                                                            {presentRegular}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between gap-2 text-slate-500">
                                                        <span>Half day</span>
                                                        <span className="tabular-nums font-medium text-yellow-600">
                                                            {c.halfDays}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between gap-2 text-slate-500">
                                                        <span>Late day</span>
                                                        <span
                                                            className="tabular-nums font-medium text-red-600"
                                                            title="Late days − half days (from attendance rules)"
                                                        >
                                                            {lateDaysAdjusted}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                                <dt className="text-slate-600">Absent</dt>
                                                <dd className="font-semibold text-orange-600 tabular-nums">{c.absents}</dd>
                                            </div>
                                            <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                                <dt className="text-slate-600">Leaves</dt>
                                                <dd className="font-semibold text-blue-600 tabular-nums">{c.leaves}</dd>
                                            </div>
                                            <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                                <dt className="text-slate-600">Sundays</dt>
                                                <dd className="font-semibold text-purple-600 tabular-nums">{c.sundays}</dd>
                                            </div>
                                            <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                                <dt className="text-slate-600">Holidays</dt>
                                                <dd className="font-semibold text-indigo-600 tabular-nums">{c.holidays}</dd>
                                            </div>
                                            <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                                <dt className="text-slate-600">Half-Days</dt>
                                                <dd className="font-semibold text-yellow-500 tabular-nums">{c.halfDays}</dd>
                                            </div>
                                            <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                                <dt className="text-slate-600">Late Days</dt>
                                                <dd
                                                    className="font-semibold text-red-600 tabular-nums"
                                                    title="Late days − half days (from attendance rules)"
                                                >
                                                    {lateDaysAdjusted}
                                                </dd>
                                            </div>
                                            <div className="flex justify-between gap-2 pt-2 items-baseline">
                                                <dt className="text-slate-800 font-medium">Pay days (for salary)</dt>
                                                <dd className="text-lg font-bold text-purple-700 tabular-nums">
                                                    {Number.isFinite(attendanceBreakdown.payDays)
                                                        ? attendanceBreakdown.payDays % 1 === 0
                                                            ? attendanceBreakdown.payDays
                                                            : attendanceBreakdown.payDays.toFixed(1)
                                                        : "—"}
                                                </dd>
                                            </div>
                                        </>
                                    );
                                }
                                const v = payrollAttendanceFallbackRows(attendanceBreakdown);
                                return (
                                    <>
                                        <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                            <dt className="text-slate-600">Full day present</dt>
                                            <dd className="font-semibold text-emerald-700 tabular-nums">{v.fullDayPresent}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                            <dt className="text-slate-600">Half days</dt>
                                            <dd className="font-semibold text-amber-700 tabular-nums">{v.halfDays}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                            <dt className="text-slate-600 leading-snug">
                                                Sunday weekly off (no punch; Sat is working)
                                            </dt>
                                            <dd className="font-semibold text-violet-700 tabular-nums shrink-0">{v.sundayOff}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                            <dt className="text-slate-600">Holidays</dt>
                                            <dd className="font-semibold text-sky-700 tabular-nums">{v.holidayN}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                            <dt className="text-slate-600">Paid leave (approved)</dt>
                                            <dd className="font-semibold text-blue-700 tabular-nums">{v.paidLeaveN}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2 py-1.5 border-b border-slate-100">
                                            <dt className="text-slate-600">LOP / unpaid absent</dt>
                                            <dd className="font-semibold text-red-700 tabular-nums">{v.lopN}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2 pt-2 items-baseline">
                                            <dt className="text-slate-800 font-medium">Pay days (for salary)</dt>
                                            <dd className="text-lg font-bold text-purple-700 tabular-nums">
                                                {Number.isFinite(attendanceBreakdown.payDays)
                                                    ? attendanceBreakdown.payDays % 1 === 0
                                                        ? attendanceBreakdown.payDays
                                                        : attendanceBreakdown.payDays.toFixed(1)
                                                    : "—"}
                                            </dd>
                                        </div>
                                    </>
                                );
                            })()}
                        </dl>
                    </div>
                )}
                </div>

                {/* Calculation Preview */}
                <div className="lg:col-span-2 space-y-6">
                    {calculation ? (
                        <>
                            {/* Summary Card */}
                            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-600">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Net Pay</p>
                                        <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(calculation.netSalary)}</h3>
                                        <span className={`inline-block px-2 py-0.5 mt-2 rounded-full text-xs font-semibold 
                                            ${formData.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                formData.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-yellow-100 text-yellow-800'}`}>
                                            {formData.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600">Gross Earnings: <span className="font-semibold text-green-600">{formatCurrency(calculation.totalEarnings)}</span></p>
                                        <p className="text-sm text-gray-600">Total Deductions: <span className="font-semibold text-red-600">{formatCurrency(calculation.totalDeductions)}</span></p>
                                    </div>
                                </div>
                            </div>

                            {payslipPreviewHtml ? (
                                <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                                    <p className="text-sm font-semibold text-slate-700 mb-3">
                                        Payslip preview — same layout as downloaded PDF
                                    </p>
                                    <div className="rounded-lg overflow-auto max-h-[min(88vh,1200px)] bg-white shadow-inner border border-slate-300">
                                        <iframe
                                            title="Salary payslip preview"
                                            className="w-full min-h-[880px] border-0 block"
                                            srcDoc={payslipPreviewHtml}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {/* Detailed Breakdown */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-green-50 rounded-lg p-5 shadow-sm">
                                    <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                                        <Calculator className="w-4 h-4 mr-2" /> Earnings
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span>Basic Salary</span> <span>{formatCurrency(calculation.basicSalary)}</span></div>
                                        <div className="flex justify-between"><span>HRA</span> <span>{formatCurrency(calculation.hra)}</span></div>
                                        <div className="flex justify-between"><span>Transport Allw.</span> <span>{formatCurrency(calculation.transportAllowance)}</span></div>
                                        <div className="flex justify-between"><span>Medical Allw.</span> <span>{formatCurrency(calculation.medicalAllowance)}</span></div>
                                        <div className="flex justify-between"><span>Special Allw.</span> <span>{formatCurrency(calculation.specialAllowance)}</span></div>
                                        <div className="flex justify-between"><span>Bonus</span> <span>{formatCurrency(calculation.bonus)}</span></div>
                                        <div className="flex justify-between"><span>Overtime</span> <span>{formatCurrency(calculation.overtimeAmount)}</span></div>
                                        <div className="border-t border-green-200 mt-2 pt-2 flex justify-between font-bold text-green-900">
                                            <span>Total</span> <span>{formatCurrency(calculation.totalEarnings)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-red-50 rounded-lg p-5 shadow-sm">
                                    <h4 className="font-semibold text-red-800 mb-3 flex items-center">
                                        <Calculator className="w-4 h-4 mr-2" /> Deductions
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        {(calculation.structureDeductions || []).map((d, i) => (
                                            <div key={`s-${i}`} className="flex justify-between">
                                                <span>{d.deduction_name}</span>
                                                <span>{formatCurrency(d.calculatedAmount)}</span>
                                            </div>
                                        ))}
                                        {calculation.processedDeductions.filter(
                                            (d) => Number(d.calculatedAmount) > 0
                                        ).length > 0
                                            ? calculation.processedDeductions
                                                  .filter((d) => Number(d.calculatedAmount) > 0)
                                                  .map((d, i) => (
                                                      <div key={i} className="flex justify-between">
                                                          <span>{d.deduction_name}</span>
                                                          <span>{formatCurrency(d.calculatedAmount)}</span>
                                                      </div>
                                                  ))
                                            : null}
                                        <div className="border-t border-red-200 mt-2 pt-2 flex justify-between font-bold text-red-900">
                                            <span>Total</span> <span>{formatCurrency(calculation.totalDeductions)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handleDownloadSalary}
                                    disabled={downloadingPdf}
                                    className={`flex items-center px-6 py-3 bg-white border-2 border-purple-600 text-purple-700 rounded-lg hover:bg-purple-50 shadow transition-all ${downloadingPdf ? "opacity-70 cursor-wait" : ""}`}
                                >
                                    {downloadingPdf ? (
                                        <>Preparing…</>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5 mr-2" />
                                            Download Salary
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className={`flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-lg transition-all ${loading ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    {loading ? (
                                        <>Processing...</>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5 mr-2" />
                                            Save Record
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-gray-400">
                            <Calculator className="w-12 h-12 mb-2 opacity-20" />
                            <p>Select an employee to generate salary</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GenerateSalaryPage;
