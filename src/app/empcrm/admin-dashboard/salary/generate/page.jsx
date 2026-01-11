"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Calculator, RefreshCw, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

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

    // Sundays State
    const [sundaysWorked, setSundaysWorked] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        working_days: 30,
        present_days: 0,
        overtime_hours: 0,
        status: 'draft'
    });

    // Calculated State
    const [calculation, setCalculation] = useState(null);

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
        try {
            // 1. Fetch Salary Structure & Deductions
            const salaryRes = await fetch(`/api/empcrm/salary?username=${selectedEmployee}&month=${selectedMonth}`);
            const salaryData = await salaryRes.json();

            if (salaryData.success) {
                setSalaryStructure(salaryData.salaryStructure);
                setDeductions(salaryData.deductions || []);

                // 2. Fetch Attendance
                const attendanceRes = await fetch(`/api/empcrm/salary/attendance-summary?month=${selectedMonth}`);
                const attendanceData = await attendanceRes.json();

                let presentDays = 0;
                let sundayDates = [];

                if (attendanceData.success) {
                    const empAtt = attendanceData.employees.find(e => e.username === selectedEmployee);
                    if (empAtt) {
                        presentDays = empAtt.present_days;
                        // Calculate Sundays worked
                        if (empAtt.dates_worked && Array.isArray(empAtt.dates_worked)) {
                            sundayDates = empAtt.dates_worked.filter(dateStr => {
                                const date = new Date(dateStr);
                                return date.getDay() === 0; // 0 is Sunday
                            });
                        }
                    }
                }
                setSundaysWorked(sundayDates);

                // Check if records already exist for this month to pre-fill
                const existingRecord = salaryData.salaryRecords?.find(r => r.salary_month === selectedMonth);

                if (existingRecord) {
                    setFormData({
                        working_days: existingRecord.working_days,
                        present_days: existingRecord.present_days,
                        overtime_hours: existingRecord.overtime_hours,
                        status: existingRecord.status || 'draft'
                    });
                    toast.success("Loaded existing draft/record for this month");
                } else {
                    setFormData(prev => ({
                        ...prev,
                        present_days: presentDays,
                        status: 'draft'
                    }));
                }
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
        const structOvertimeRate = Number(salaryStructure.overtime_rate) || 0;

        const dailyRate = structBasic / workingDays;
        const basicSalary = dailyRate * presentDays;

        // HRA logic
        const hra = structBasic > 0 ? (structHra / structBasic) * basicSalary : 0;

        const transportAllowance = structTransport;
        const medicalAllowance = structMedical;
        const specialAllowance = structSpecial;
        const bonus = structBonus;
        const overtimeAmount = overtimeHours * structOvertimeRate;

        const totalEarnings = basicSalary + hra + transportAllowance + medicalAllowance + specialAllowance + bonus + overtimeAmount;

        // Deductions
        let totalDeductions = 0;
        const processedDeductions = deductions.map(deduction => {
            let amount = 0;
            const code = deduction.deduction_code;
            const name = deduction.deduction_name;

            // Robust check for standard deductions
            const isPF = code === 'PF' || name === 'PF' || name.includes('Provident Fund');
            const isESI = code === 'ESI' || name === 'ESI' || name.includes('ESI');
            const isIT = code === 'IT' || name === 'IT' || name.includes('Income Tax');
            const isPT = code === 'PT' || name === 'PT' || name.includes('Professional Tax');

            // 1. Priority: Fixed Amount checking
            if (deduction.calculation_type === 'fixed' || (Number(deduction.amount) > 0 && !deduction.percentage && deduction.calculation_type !== 'formula')) {
                amount = Number(deduction.amount);
            }
            // 2. Priority: Percentage
            else if (deduction.calculation_type === 'percentage' && Number(deduction.percentage) > 0) {
                amount = (Number(deduction.percentage) / 100) * totalEarnings;
            }
            // 3. Priority: Standard Formula / Code-based Fallback
            else {
                if (isPF) {
                    amount = 0.12 * basicSalary;
                } else if (isESI) {
                    amount = 0.0075 * totalEarnings;
                } else if (isIT) {
                    const annualIncome = totalEarnings * 12;
                    if (annualIncome > 250000) {
                        amount = ((annualIncome - 250000) * 0.1) / 12;
                    } else {
                        amount = 0;
                    }
                } else if (isPT) {
                    // PT default
                    amount = 200;
                } else {
                    // Final fallback
                    amount = Number(deduction.amount) || 0;
                }
            }

            totalDeductions += amount;
            return { ...deduction, calculatedAmount: amount };
        });

        const netSalary = totalEarnings - totalDeductions;

        setCalculation({
            basicSalary,
            hra,
            transportAllowance,
            medicalAllowance,
            specialAllowance,
            bonus,
            overtimeAmount,
            totalEarnings,
            processedDeductions,
            totalDeductions,
            netSalary
        });
    };

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
                {/* Controls */}
                <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6 h-fit">
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
                                        {calculation.processedDeductions.length > 0 ? (
                                            calculation.processedDeductions.map((d, i) => (
                                                <div key={i} className="flex justify-between">
                                                    <span>{d.deduction_name}</span>
                                                    <span>{formatCurrency(d.calculatedAmount)}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 italic">No active deductions</p>
                                        )}
                                        <div className="border-t border-red-200 mt-2 pt-2 flex justify-between font-bold text-red-900">
                                            <span>Total</span> <span>{formatCurrency(calculation.totalDeductions)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
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
