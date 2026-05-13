"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Pencil,
    Plus,
    Search,
    Trash2,
    CheckCircle,
    Clock,
    FileText,
    User,
    MapPin,
    DollarSign,
    Upload,
    ChevronRight,
    ChevronLeft,
    X,
    Eye
} from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

const StatusBadge = ({ status }) => {
    const styles = {
        Assigned: "text-[12px] bg-blue-100 text-blue-700 border-blue-200",
        Created: "text-[12px] bg-blue-100 text-blue-700 border-blue-200",
        Filled: "text-[12px] bg-yellow-100 text-yellow-700 border-yellow-200",
        Issued: "text-[12px] bg-red-100 text-red-700 border-red-200",
        "Sent to Client": "text-[12px] bg-purple-100 text-purple-700 border-purple-200",
        Claimed: "text-[12px] bg-green-100 text-green-700 border-green-200",
    };

    const displayStatus = status === "Assigned" ? "Created" : status;

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
            {displayStatus}
        </span>
    );
};

export default function DDManagementPage() {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [userRole, setUserRole] = useState("GUEST");
    const [currentUserName, setCurrentUserName] = useState("");

    const [activeModal, setActiveModal] = useState(null); // null, 0 (selection), 1, 2, 3, or 'payment'
    const [selectedDD, setSelectedDD] = useState(null);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [statements, setStatements] = useState([]);
    const [loadingStatements, setLoadingStatements] = useState(false);
    const [paymentSearch, setPaymentSearch] = useState("");
    const [paymentDateFrom, setPaymentDateFrom] = useState("");
    const [paymentDateTo, setPaymentDateTo] = useState("");
    const [creditModalOpen, setCreditModalOpen] = useState(false);
    const [creditStatements, setCreditStatements] = useState([]);
    const [loadingCreditStatements, setLoadingCreditStatements] = useState(false);
    const [creditSearch, setCreditSearch] = useState("");
    const [creditDateFrom, setCreditDateFrom] = useState("");
    const [creditDateTo, setCreditDateTo] = useState("");

    const isAuthorized = ["ADMIN", "SUPERADMIN", "ACCOUNTANT"].includes(userRole.toUpperCase());

    // Form State
    const [formData, setFormData] = useState({
        type: "DD", // "DD", "BG", or "EPAYMENT"
        dd_location: "",
        party_name: "",
        amount: "",
        assign_date: dayjs().format("YYYY-MM-DD"),
        assigned_by: "",
        mode_of_payment: "DD",
        contract_no: "",
        security_type: "",
        bid_document: null,
        remark: "",

        // BG Specific Step 1
        beneficiary_name: "",
        beneficiary_address: "",
        expiry_date: "",
        claim_expiry_date: "",
        bg_format_upload: null,

        status: "Assigned"
    });

    const fetchUser = async () => {
        try {
            const res = await fetch("/api/auth/current-user");
            const result = await res.json();
            if (res.ok) {
                const user = result.user;
                setUserRole(user?.role || "GUEST");
                const username = user?.username || user?.name || "";
                setCurrentUserName(username);
                // Pre-fill assigned_by only if it's a new record
                setFormData(prev => ({
                    ...prev,
                    assigned_by: prev.assigned_by || username
                }));
            }
        } catch (err) {
            console.error("Failed to fetch user role");
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/dd-management?status=${statusFilter}&search=${search}`);
            const result = await res.json();
            if (res.ok) {
                setData(result.data || []);
            } else {
                toast.error(result.error || "Failed to fetch data");
            }
        } catch (err) {
            toast.error("Network error fetching DD records");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
        fetchData();
    }, [statusFilter, search]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        // Prevent non-authorized users from changing Step 2/3 fields if they somehow bypass UI
        const step2Fields = ["cheque_no", "bank_name", "account_number", "branch", "filled_by", "filled_date"];
        const step3Fields = ["dd_number", "issued_by", "status", "original_dd_location", "sent_to_client_date", "claim_from_bank"];

        if (!isAuthorized && (step2Fields.includes(name) || step3Fields.includes(name))) {
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        const { name, files } = e.target;
        const bgFiles = ["bg_format_upload", "original_bg_upload", "docs_upload"];
        if (!isAuthorized && (name === "cheque_upload" || name === "signature_upload" || name === "dd_upload" || bgFiles.includes(name))) {
            return;
        }
        setFormData(prev => ({ ...prev, [name]: files[0] }));
    };

    const uploadFiles = async () => {
        const fileData = new FormData();
        let hasFiles = false;
        if (formData.bg_format_upload instanceof File) { fileData.append("bg_format_upload", formData.bg_format_upload); hasFiles = true; }
        if (formData.bid_document instanceof File) { fileData.append("bid_document", formData.bid_document); hasFiles = true; }

        if (!hasFiles) return {};

        const res = await fetch("/api/dd-management/upload", {
            method: "POST",
            body: fileData
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Upload failed");
        return result.paths;
    };

    const openPaymentModal = async (dd) => {
        setSelectedDD(dd);
        setPaymentModalOpen(true);
        setLoadingStatements(true);
        try {
            const res = await fetch("/api/statements", { credentials: "include" });
            const result = await res.json();
            if (res.ok) {
                setStatements(result.statements || []);
            } else {
                toast.error(result.error || "Failed to load statements");
            }
        } catch (err) {
            toast.error("Network error loading statements");
        } finally {
            setLoadingStatements(false);
        }
    };

    const openCreditModal = async (dd) => {
        setSelectedDD(dd);
        setCreditModalOpen(true);
        setLoadingCreditStatements(true);
        try {
            const res = await fetch("/api/statements", { credentials: "include" });
            const result = await res.json();
            if (res.ok) {
                setCreditStatements(result.statements || []);
            } else {
                toast.error(result.error || "Failed to load statements");
            }
        } catch (err) {
            toast.error("Network error loading statements");
        } finally {
            setLoadingCreditStatements(false);
        }
    };

    const linkPayment = async (statementId, type, action = 'link') => {
        const isUnlink = action === 'unlink';
        const selectedStatement = (type === 'debit' ? statements : creditStatements).find((s) => Number(s.id) === Number(statementId));
        const ddAmount = Number(selectedDD?.amount || 0);
        const statementAmount = Math.abs(Number(selectedStatement?.amount || 0));

        if (!isUnlink && ddAmount !== statementAmount) {
            toast.error(`Amount mismatch: DD net amount ₹${ddAmount.toLocaleString('en-IN')} and statement amount ₹${statementAmount.toLocaleString('en-IN')} must match`);
            return;
        }

        try {
            const res = await fetch(`/api/statements/${statementId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    invoice_status: isUnlink ? 'Unsettled' : 'Linked to DD',
                    purchase_id: selectedDD?.id,
                    dd_id: isUnlink ? null : selectedDD?.id,
                    dd_action: action
                })
            });
            if (res.ok) {
                toast.success(isUnlink ? 'Payment unlinked successfully' : 'Payment linked successfully');
                
                // Auto-set claim_from_bank and status only from Payment Link
                if (selectedDD?.id && type === 'credit') {
                    try {
                        await fetch(`/api/dd-management/${selectedDD.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                claim_from_bank: !isUnlink,
                                status: !isUnlink ? "Claimed" : "Unclaimed"
                            })
                        });
                    } catch (error) {
                        console.error("Failed to auto-set claim_from_bank and status", error);
                    }
                }
                
                if (type === 'debit') {
                    const res = await fetch("/api/statements", { credentials: "include" });
                    const result = await res.json();
                    if (res.ok) setStatements(result.statements || []);
                } else {
                    const res = await fetch("/api/statements", { credentials: "include" });
                    const result = await res.json();
                    if (res.ok) setCreditStatements(result.statements || []);
                }
                fetchData();
            } else {
                const result = await res.json();
                toast.error(result.error || (isUnlink ? 'Failed to unlink payment' : 'Failed to link payment'));
            }
        } catch (err) {
            toast.error(isUnlink ? 'Network error unlinking payment' : 'Network error linking payment');
        }
    };

    const handleSubmit = async (step, shouldClose = true) => {
        try {
            const uploadedPaths = await uploadFiles();

            const payload = { ...formData, ...uploadedPaths };
            // Clean up File objects (only if they haven't been replaced by string paths)
            if (payload.bg_format_upload instanceof File) delete payload.bg_format_upload;
            if (payload.bid_document instanceof File) delete payload.bid_document;

            // Automation: Update status based on the step being saved (only Step 1)
            if (step === 1) {
                if (payload.type === "BG") {
                    if (!payload.status || payload.status === "Assigned") payload.status = "Filled";
                } else {
                    if (!payload.status || payload.status === "Assigned") payload.status = "Assigned"; // For DD/EPAYMENT, Step 1 is just Assignment
                }
            }

            const method = selectedDD ? "PUT" : "POST";
            const url = selectedDD ? `/api/dd-management/${selectedDD.id}` : "/api/dd-management";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (res.ok) {
                toast.success(`Step ${step} saved successfully`);

                let nextDD = selectedDD;
                if (!selectedDD && result.data) {
                    nextDD = { ...formData, id: result.data.id };
                    setSelectedDD(nextDD);
                }

                if (shouldClose) {
                    setActiveModal(null);
                } else {
                    setActiveModal(null); // Only Step 1, so always close
                }

                fetchData();
                return true;
            } else {
                toast.error(result.error || "Submission failed");
                return false;
            }
        } catch (err) {
            toast.error(err.message || "Something went wrong");
            return false;
        }
    };

    const openStepModal = (dd, step) => {
        if (!dd && step === 1) {
            resetForm();
            setActiveModal(0); // Show selection first for new records
            return;
        }
        setSelectedDD(dd);
        if (dd) {
            setFormData({
                ...dd,
                status: dd.status || "Assigned",
                assign_date: dd.assign_date ? dayjs(dd.assign_date).format("YYYY-MM-DD") : "",
                expiry_date: dd.expiry_date ? dayjs(dd.expiry_date).format("YYYY-MM-DD") : "",
                claim_expiry_date: dd.claim_expiry_date ? dayjs(dd.claim_expiry_date).format("YYYY-MM-DD") : "",
                bg_format_upload: dd.bg_format_upload,
                bid_document: dd.bid_document,
                remark: dd.remark || ""
            });
        } else {
            resetForm();
        }
        setActiveModal(step);
    };

    const getBlankFormData = (type = "DD") => ({
            type,
            dd_location: "",
            party_name: "",
            amount: "",
            assign_date: dayjs().format("YYYY-MM-DD"),
            assigned_by: currentUserName || "",
            mode_of_payment: type === "EPAYMENT" ? "EPAYMENT" : type,
            contract_no: "",
            security_type: "",
            bid_document: null,
            remark: "",
            beneficiary_name: "",
            beneficiary_address: "",
            expiry_date: "",
            claim_expiry_date: "",
            bg_format_upload: null,
            status: "Assigned"
        });

    const resetForm = () => {
        setSelectedDD(null);
        setActiveModal(null);
        setFormData(getBlankFormData());
        fetchUser(); // Refresh pre-fill from session
    };
    const handleViewFile = (filePath) => {
        if (!filePath) return;
        window.open(filePath, "_blank");
    };

    const handleClaimFromBankChange = (e) => {
        const { checked } = e.target;
        setFormData(prev => ({
            ...prev,
            claim_from_bank: checked,
            status: checked ? "Claimed" : prev.status
        }));
    };

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 bg-white p-6 rounded-xl shadow-sm">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Demand Draft Management</h1>
                    <p className="text-gray-500 text-sm mt-1">Track and manage DD requests through the issuance workflow. (Role: {userRole})</p>
                </div>
                <button
                    onClick={() => openStepModal(null, 1)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                    <Plus size={20} /> New Assign
                </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="relative col-span-2">
                    <Search className="absolute left-3 top-1/2 -reverse-y-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search party name, location or DD number..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Statuses</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Filled">Filled</option>
                    <option value="Issued">Issued</option>
                    <option value="Sent to Client">Sent to Client</option>
                </select>
                <div className="flex items-center gap-2 text-sm text-gray-500 justify-end">
                    <Clock size={16} /> Total Records: <span className="font-bold text-gray-900">{data.length}</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount & Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Bank Info & Docs</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Issued Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Claimed From Bank</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr><td colSpan="7" className="px-6 py-10 text-center animate-pulse text-gray-400">Loading records...</td></tr>
                            ) : data.length > 0 ? (
                                data.map((dd) => (
                                    <tr key={dd.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${dd.type === 'BG' ? 'bg-purple-100 text-purple-600' : dd.type === 'EPAYMENT' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center font-bold shadow-sm group-hover:scale-110 transition-transform`}>
                                                    {dd.type === 'BG' ? 'BG' : dd.type === 'EPAYMENT' ? 'EP' : 'DD'}
                                                </div>
                                                <div className="text-xs">
                                                    <div className="font-bold text-gray-800">{dd.type === 'BG' ? dd.beneficiary_name : dd.party_name}</div>
                                                    <div className="text-gray-500 flex items-center gap-1">
                                                        <MapPin size={10} /> {dd.type === 'BG' ? (dd.beneficiary_address?.substring(0, 20) + "...") : dd.dd_location}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs">
                                                <div className="font-bold text-gray-800">₹{parseFloat(dd.amount).toLocaleString()}</div>
                                                <div className="text-gray-500 font-medium">{dayjs(dd.assign_date).format("DD MMM YYYY")}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs">
                                                <div className="font-bold text-gray-800 flex items-center justify-between">
                                                    <span>{dd.bank_name || "N/A"}</span>
                                                    <div className="flex gap-1">
                                                        {dd.type === 'BG' ? (
                                                            <>
                                                                {dd.bg_format_upload && <button onClick={() => handleViewFile(dd.bg_format_upload)} className="p-1 text-purple-500 hover:bg-purple-100 rounded transition-colors" title="View BG Format"><Eye size={14} /></button>}
                                                                {dd.original_bg_upload && <button onClick={() => handleViewFile(dd.original_bg_upload)} className="p-1 text-purple-700 hover:bg-purple-100 rounded transition-colors" title="View Original BG"><Eye size={14} /></button>}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {dd.cheque_upload && <button onClick={() => handleViewFile(dd.cheque_upload)} className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors" title="View Cheque"><Eye size={14} /></button>}
                                                                {dd.signature_upload && <button onClick={() => handleViewFile(dd.signature_upload)} className="p-1 text-purple-500 hover:bg-purple-100 rounded transition-colors" title="View Signature"><Eye size={14} /></button>}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-gray-500">{dd.type === 'BG' ? `FD: ${dd.fd_number || "N/A"}` : `Chq: ${dd.cheque_no || "N/A"}`}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs space-y-1">
                                                <div className={`${dd.type === 'BG' ? 'text-purple-600' : 'text-green-600'} font-bold flex items-center justify-between tracking-wider`}>
                                                    <span>#{dd.type === 'BG' ? (dd.bg_number || "PENDING") : (dd.dd_number || "PENDING")}</span>
                                                    {dd.type === 'BG' ? (
                                                        dd.docs_upload && <button onClick={() => handleViewFile(dd.docs_upload)} className="p-1 text-purple-500 hover:bg-purple-100 rounded transition-colors" title="View BG Docs"><Eye size={14} /></button>
                                                    ) : (
                                                        dd.dd_upload && <button onClick={() => handleViewFile(dd.dd_upload)} className="p-1 text-green-500 hover:bg-green-100 rounded transition-colors" title="View DD Copy"><Eye size={14} /></button>
                                                    )}
                                                </div>
                                                <div className="text-gray-500">
                                                    {dd.type === 'BG' ? (
                                                        dd.expiry_date ? `Exp: ${dayjs(dd.expiry_date).format("DD MMM YYYY")}` : "No Expiry"
                                                    ) : (
                                                        dayjs(dd.updated_at).format("DD MMM YYYY")
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={dd.status} />
                                            <div className="text-[12px] text-gray-400 mt-1">
                                                By: {dd.assigned_by}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${dd.claim_from_bank ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                                    {dd.claim_from_bank ? "Yes" : "No"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => openStepModal(dd, 1)}
                                                    className="p-1 px-2 text-blue-600 hover:bg-blue-50 rounded border border-blue-100 transition-colors text-[10px] font-bold"
                                                    title="Step 1: Assignment"
                                                >
                                                    Step 1
                                                </button>
                                                {isAuthorized && (
                                                    <>
                                                        <button
                                                            onClick={() => openStepModal(dd, 2)}
                                                            className="p-1 px-2 text-yellow-600 hover:bg-yellow-50 rounded border border-yellow-100 transition-colors text-[10px] font-bold"
                                                            title="Step 2: Bank Info"
                                                        >
                                                            Step 2
                                                        </button>
                                                        <button
                                                            onClick={() => openPaymentModal(dd)}
                                                            className="p-1 px-2 text-emerald-600 hover:bg-emerald-50 rounded border border-emerald-100 transition-colors text-[10px] font-bold"
                                                            title="Add Payment"
                                                        >
                                                            Add Payment
                                                        </button>
                                                        <button
                                                            onClick={() => openCreditModal(dd)}
                                                            className="p-1 px-2 text-emerald-600 hover:bg-emerald-50 rounded border border-emerald-100 transition-colors text-[10px] font-bold"
                                                            title="Link Payment"
                                                        >
                                                            Payment Link
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">No records found matching your filters.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Logic */}
            {activeModal === 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="bg-gray-800 p-6 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">New Assignment</h2>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-gray-700 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-4">
                            <p className="text-gray-500 text-center mb-6">What type of record would you like to create?</p>
                            <button
                                onClick={() => { setSelectedDD(null); setFormData(getBlankFormData("DD")); setActiveModal(1); }}
                                className="w-full py-4 bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition-all flex flex-col items-center gap-2"
                            >
                                <FileText size={32} />
                                Demand Draft (DD)
                            </button>
                            <button
                                onClick={() => { setSelectedDD(null); setFormData(getBlankFormData("BG")); setActiveModal(1); }}
                                className="w-full py-4 bg-purple-50 text-purple-700 border-2 border-purple-200 rounded-xl font-bold hover:bg-purple-100 transition-all flex flex-col items-center gap-2"
                            >
                                <CheckCircle size={32} />
                                Bank Guarantee (BG)
                            </button>
                            <button
                                onClick={() => { setSelectedDD(null); setFormData(getBlankFormData("EPAYMENT")); setActiveModal(1); }}
                                className="w-full py-4 bg-emerald-50 text-emerald-700 border-2 border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition-all flex flex-col items-center gap-2"
                            >
                                <DollarSign size={32} />
                                E-payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 1 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className={`${formData.type === "BG" ? "bg-purple-600" : formData.type === "EPAYMENT" ? "bg-emerald-600" : "bg-blue-600"} p-6 text-white flex justify-between items-center`}>
                            <div>
                                <h2 className="text-xl font-bold">
                                    {selectedDD ? `Edit ${formData.type} (Step 1)` : `New ${formData.type} Assignment`}
                                </h2>
                                <p className="text-xs opacity-80 mt-1">Manage basic {formData.type} details</p>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-black/20 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
                            {formData.type === "BG" ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Beneficiary Name</label>
                                            <input disabled={selectedDD?.beneficiary_name} name="beneficiary_name" value={formData.beneficiary_name} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="e.g. Director General, Supply" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Beneficiary Address</label>
                                            <textarea disabled={selectedDD?.beneficiary_address} name="beneficiary_address" value={formData.beneficiary_address} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed min-h-[80px]" placeholder="Enter full address" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                            <input disabled={selectedDD?.amount} type="number" name="amount" value={formData.amount} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="0.00" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assign Date</label>
                                            <input disabled={selectedDD?.assign_date} type="date" name="assign_date" value={formData.assign_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expiry Date</label>
                                            <input disabled={selectedDD?.expiry_date} type="date" name="expiry_date" value={formData.expiry_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Claim Expiry Date</label>
                                            <input disabled={selectedDD?.claim_expiry_date} type="date" name="claim_expiry_date" value={formData.claim_expiry_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mode of Payment</label>
                                        <select disabled={selectedDD?.mode_of_payment} name="mode_of_payment" value={formData.mode_of_payment} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed">
                                            <option value="NEFT">NEFT</option>
                                            <option value="IMPS">IMPS</option>
                                            <option value="DD">DD</option>
                                            <option value="RTGS">RTGS</option>
                                            <option value="BG">BG</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contract No</label>
                                            <input disabled={selectedDD?.contract_no} name="contract_no" value={formData.contract_no || ""} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="Enter contract number" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">For</label>
                                            <select disabled={selectedDD?.security_type} name="security_type" value={formData.security_type} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed">
                                                <option value="">Select Security Type</option>
                                                <option value="EMD">EMD</option>
                                                <option value="BG">BG</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Upload BG Format</label>
                                        <div className="flex items-center gap-2">
                                            <input type="file" name="bg_format_upload" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 disabled:opacity-50" />
                                            {formData.bg_format_upload && typeof formData.bg_format_upload === "string" && (
                                                <button onClick={() => handleViewFile(formData.bg_format_upload)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg flex items-center gap-1 text-xs font-bold" title="View BG Format">
                                                    <Eye size={16} /> View
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bid Document</label>
                                        <div className="flex items-center gap-2">
                                            <input type="file" name="bid_document" onChange={handleFileChange} accept="image/*" className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 disabled:opacity-50" />
                                            {formData.bid_document && typeof formData.bid_document === "string" && (
                                                <button onClick={() => handleViewFile(formData.bid_document)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg flex items-center gap-1 text-xs font-bold" title="View Bid Document">
                                                    <Eye size={16} /> View
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Remark</label>
                                        <textarea disabled={selectedDD?.remark} name="remark" value={formData.remark} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed min-h-[80px]" placeholder="Enter any remarks" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">DD Location</label>
                                            <input disabled={selectedDD?.dd_location} name="dd_location" value={formData.dd_location} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="e.g. Mumbai Main Branch" />
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Party Name (Favour)</label>
                                            <input disabled={selectedDD?.party_name} name="party_name" value={formData.party_name} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter party name" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                            <input disabled={selectedDD?.amount} type="number" name="amount" value={formData.amount} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="0.00" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assign Date</label>
                                            <input disabled={selectedDD?.assign_date} type="date" name="assign_date" value={formData.assign_date} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mode of Payment</label>
                                        <select disabled={selectedDD?.mode_of_payment} name="mode_of_payment" value={formData.mode_of_payment} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`}>
                                            <option value="NEFT">NEFT</option>
                                            <option value="IMPS">IMPS</option>
                                            <option value="DD">DD</option>
                                            <option value="RTGS">RTGS</option>
                                            <option value="BG">BG</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contract No</label>
                                            <input disabled={selectedDD?.contract_no} name="contract_no" value={formData.contract_no || ""} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter contract number" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">For</label>
                                            <select disabled={selectedDD?.security_type} name="security_type" value={formData.security_type} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`}>
                                                <option value="">Select Security Type</option>
                                                <option value="EMD">EMD</option>
                                                <option value="BG">BG</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bid Document</label>
                                        <div className="flex items-center gap-2">
                                            <input type="file" name="bid_document" onChange={handleFileChange} accept="image/*" className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold ${formData.type === "EPAYMENT" ? "file:bg-emerald-50 file:text-emerald-700" : "file:bg-blue-50 file:text-blue-700"} disabled:opacity-50`} />
                                            {formData.bid_document && typeof formData.bid_document === "string" && (
                                                <button onClick={() => handleViewFile(formData.bid_document)} className={`p-2 rounded-lg ${formData.type === "EPAYMENT" ? "text-emerald-600 hover:bg-emerald-50" : "text-blue-600 hover:bg-blue-50"}`} title="View Bid Document">
                                                    <Eye size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Remark</label>
                                        <textarea disabled={selectedDD?.remark} name="remark" value={formData.remark} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed min-h-[80px] ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter any remarks" />
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assigned By</label>
                                <input disabled name="assigned_by" value={formData.assigned_by} className="w-full p-2.5 border rounded-lg bg-gray-100 cursor-not-allowed outline-none" placeholder="Automated from session" />
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                            <button onClick={() => setActiveModal(null)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                            {isAuthorized ? (
                                <button
                                    onClick={() => {
                                        if (formData.type === "BG") {
                                            if (!formData.beneficiary_name || !formData.amount || !formData.expiry_date) {
                                                toast.error("Required: Beneficiary, Amount, Expiry Date"); return;
                                            }
                                        } else {
                                            if (!formData.party_name || !formData.amount || !formData.dd_location || !formData.assign_date) {
                                                toast.error("Required: Party, Amount, Location, Date"); return;
                                            }
                                        }
                                        handleSubmit(1, false);
                                    }}
                                    className={`flex items-center gap-2 ${formData.type === "BG" ? "bg-purple-600 hover:bg-purple-700" : formData.type === "EPAYMENT" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"} text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md`}
                                >
                                    Save & Next <ChevronRight size={20} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (formData.type === "BG") {
                                            if (!formData.beneficiary_name || !formData.amount || !formData.expiry_date) {
                                                toast.error("Required: Beneficiary, Amount, Expiry Date"); return;
                                            }
                                        } else {
                                            if (!formData.party_name || !formData.amount || !formData.dd_location || !formData.assign_date) {
                                                toast.error("Required: Party, Amount, Location, Date"); return;
                                            }
                                        }
                                        handleSubmit(1, true);
                                    }}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md"
                                >
                                    <CheckCircle size={20} /> {selectedDD ? "Save Changes" : "Create Assignment"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 2 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className={`${formData.type === "BG" ? "bg-purple-600" : formData.type === "EPAYMENT" ? "bg-emerald-600" : "bg-blue-600"} p-6 text-white flex justify-between items-center`}>
                            <div>
                                <h2 className="text-xl font-bold">Process {formData.type} (Step 2)</h2>
                                <p className="text-xs opacity-80 mt-1">
                                    {formData.type === "BG" ? "Bank details and BG issuance" : "Bank details and cheque info"}
                                </p>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-black/20 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
                            {formData.type === "BG" ? (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mode of Payment</label>
                                        <select name="mode_of_payment" value={formData.mode_of_payment} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                                            <option value="NEFT">NEFT</option>
                                            <option value="IMPS">IMPS</option>
                                            <option value="DD">DD</option>
                                            <option value="RTGS">RTGS</option>
                                            <option value="BG">BG</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">FD Number</label>
                                            <input disabled={selectedDD?.fd_number} name="fd_number" value={formData.fd_number} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="Enter FD Number" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">BG Number</label>
                                            <input disabled={selectedDD?.bg_number} name="bg_number" value={formData.bg_number} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="Enter BG Number" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bank Name</label>
                                            <input disabled={selectedDD?.bank_name} name="bank_name" value={formData.bank_name} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="e.g. HDFC Bank" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Number</label>
                                            <input disabled={selectedDD?.account_number} name="account_number" value={formData.account_number} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="1234xxxx90" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Branch</label>
                                            <input disabled={selectedDD?.branch} name="branch" value={formData.branch} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="Branch Name" />
                                        </div>
                                    </div>
                                    {["NEFT", "RTGS", "IMPS"].includes(formData.mode_of_payment) && (
                                        <>
                                            <div className="pt-4 border-t">
                                                <h3 className="text-sm font-bold text-gray-700 mb-3">Payment Details</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reference No</label>
                                                    <input disabled={selectedDD?.reference_no} name="reference_no" value={formData.reference_no} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="Enter reference number" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                                    <input disabled={selectedDD?.payment_amount} type="number" name="payment_amount" value={formData.payment_amount} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="0.00" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                                    <input disabled={selectedDD?.payment_date} type="date" name="payment_date" value={formData.payment_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">From Bank Account No</label>
                                                    <input disabled={selectedDD?.from_bank_account_no} name="from_bank_account_no" value={formData.from_bank_account_no} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="Enter account number" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Proof <span className="text-red-500">*</span></label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" name="payment_proof" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700" />
                                                        {formData.payment_proof && typeof formData.payment_proof === "string" && (
                                                            <button onClick={() => handleViewFile(formData.payment_proof)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="View Payment Proof">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Receipt <span className="text-red-500">*</span></label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" name="receipt" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700" />
                                                        {formData.receipt && typeof formData.receipt === "string" && (
                                                            <button onClick={() => handleViewFile(formData.receipt)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="View Receipt">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    {formData.mode_of_payment === "BG" && (
                                        <>
                                            <div className="pt-4 border-t">
                                                <h3 className="text-sm font-bold text-gray-700 mb-3">BG Details</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                                    <input disabled={selectedDD?.bg_date} type="date" name="bg_date" value={formData.bg_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                                    <input disabled={selectedDD?.bg_amount} type="number" name="bg_amount" value={formData.bg_amount} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="0.00" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">BG No</label>
                                                    <input disabled={selectedDD?.bg_number_field} name="bg_number_field" value={formData.bg_number_field} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="Enter BG number" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Validity Upto</label>
                                                    <input disabled={selectedDD?.validity_upto} type="date" name="validity_upto" value={formData.validity_upto} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Client Name</label>
                                                    <input disabled={selectedDD?.client_name} name="client_name" value={formData.client_name} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100" placeholder="Enter client name" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Scan Copy <span className="text-red-500">*</span></label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" name="bg_scan_copy" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700" />
                                                        {formData.bg_scan_copy && typeof formData.bg_scan_copy === "string" && (
                                                            <button onClick={() => handleViewFile(formData.bg_scan_copy)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="View Scan Copy">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Original BG Upload</label>
                                            <div className="flex items-center gap-2">
                                                <input type="file" name="original_bg_upload" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700" />
                                                {formData.original_bg_upload && typeof formData.original_bg_upload === "string" && (
                                                    <button onClick={() => handleViewFile(formData.original_bg_upload)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="View BG">
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Other Docs Upload</label>
                                            <div className="flex items-center gap-2">
                                                <input type="file" name="docs_upload" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700" />
                                                {formData.docs_upload && typeof formData.docs_upload === "string" && (
                                                    <button onClick={() => handleViewFile(formData.docs_upload)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="View Docs">
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filled By</label>
                                            <input disabled name="filled_by" value={formData.filled_by} className="w-full p-2.5 border rounded-lg bg-gray-100 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filled Date</label>
                                            <input type="date" name="filled_date" value={formData.filled_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg outline-none" />
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Original BG Location</label>
                                        <div className="flex gap-4">
                                            {["Self", "Client"].map(loc => (
                                                <label key={loc} className="flex items-center gap-2 cursor-pointer group">
                                                    <input
                                                        type="radio"
                                                        name="original_dd_location"
                                                        value={loc}
                                                        checked={formData.original_dd_location === loc}
                                                        onChange={handleInputChange}
                                                        className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                    />
                                                    <span className={`text-sm font-bold ${formData.original_dd_location === loc ? "text-purple-700" : "text-gray-500 group-hover:text-gray-700"}`}>{loc}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Mode of Payment</label>
                                        <select name="mode_of_payment" value={formData.mode_of_payment} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`}>
                                            <option value="NEFT">NEFT</option>
                                            <option value="IMPS">IMPS</option>
                                            <option value="DD">DD</option>
                                            <option value="RTGS">RTGS</option>
                                            <option value="BG">BG</option>
                                        </select>
                                    </div>
                                    {/* Commented out bank fields
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cheque Number</label>
                                            <input disabled={selectedDD?.cheque_no} name="cheque_no" value={formData.cheque_no} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="6-digit number" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Upload Cheque Copy</label>
                                            <div className="flex items-center gap-2">
                                                <input disabled={!isAuthorized} type="file" name="cheque_upload" onChange={handleFileChange} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold ${formData.type === "EPAYMENT" ? "file:bg-emerald-50 file:text-emerald-700" : "file:bg-blue-50 file:text-blue-700"} disabled:opacity-50`} />
                                                {formData.cheque_upload && typeof formData.cheque_upload === "string" && (
                                                    <button onClick={() => handleViewFile(formData.cheque_upload)} className={`p-2 rounded-lg flex items-center gap-1 text-xs font-bold ${formData.type === "EPAYMENT" ? "text-emerald-600 hover:bg-emerald-50" : "text-blue-600 hover:bg-blue-50"}`} title="View Cheque">
                                                        <Eye size={16} /> View
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bank Name</label>
                                            <input disabled={selectedDD?.bank_name} name="bank_name" value={formData.bank_name} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="e.g. SBI, HDFC" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Number</label>
                                            <input disabled={selectedDD?.account_number} name="account_number" value={formData.account_number} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Full account number" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Branch</label>
                                            <input disabled={selectedDD?.branch} name="branch" value={formData.branch} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Branch location" />
                                        </div>
                                    </div>
                                    */}
                                    {["NEFT", "RTGS", "IMPS"].includes(formData.mode_of_payment) && (
                                        <>
                                            <div className="pt-4 border-t">
                                                <h3 className="text-sm font-bold text-gray-700 mb-3">Payment Details</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reference No</label>
                                                    <input disabled={selectedDD?.reference_no} name="reference_no" value={formData.reference_no} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter reference number" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                                    <input disabled={selectedDD?.payment_amount} type="number" name="payment_amount" value={formData.payment_amount} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="0.00" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                                    <input disabled={selectedDD?.payment_date} type="date" name="payment_date" value={formData.payment_date} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">From Bank Account No</label>
                                                    <input disabled={selectedDD?.from_bank_account_no} name="from_bank_account_no" value={formData.from_bank_account_no} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter account number" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Payment Proof <span className="text-red-500">*</span></label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" name="payment_proof" onChange={handleFileChange} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold ${formData.type === "EPAYMENT" ? "file:bg-emerald-50 file:text-emerald-700" : "file:bg-blue-50 file:text-blue-700"}`} />
                                                        {formData.payment_proof && typeof formData.payment_proof === "string" && (
                                                            <button onClick={() => handleViewFile(formData.payment_proof)} className={`p-2 rounded-lg ${formData.type === "EPAYMENT" ? "text-emerald-600 hover:bg-emerald-50" : "text-blue-600 hover:bg-blue-50"}`} title="View Payment Proof">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Receipt <span className="text-red-500">*</span></label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" name="receipt" onChange={handleFileChange} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold ${formData.type === "EPAYMENT" ? "file:bg-emerald-50 file:text-emerald-700" : "file:bg-blue-50 file:text-blue-700"}`} />
                                                        {formData.receipt && typeof formData.receipt === "string" && (
                                                            <button onClick={() => handleViewFile(formData.receipt)} className={`p-2 rounded-lg ${formData.type === "EPAYMENT" ? "text-emerald-600 hover:bg-emerald-50" : "text-blue-600 hover:bg-blue-50"}`} title="View Receipt">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    {formData.mode_of_payment === "DD" && (
                                        <>
                                            <div className="pt-4 border-t">
                                                <h3 className="text-sm font-bold text-gray-700 mb-3">DD Details</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">DD No</label>
                                                    <input disabled={selectedDD?.dd_no} name="dd_no" value={formData.dd_no} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter DD number" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">DD Date</label>
                                                    <input disabled={selectedDD?.dd_date} type="date" name="dd_date" value={formData.dd_date} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                                    <input disabled={selectedDD?.payment_amount} type="number" name="payment_amount" value={formData.payment_amount} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="0.00" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Beneficiary Name</label>
                                                    <input disabled={selectedDD?.dd_beneficiary_name} name="dd_beneficiary_name" value={formData.dd_beneficiary_name} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter beneficiary name" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expiry Bank Date</label>
                                                    <input disabled={selectedDD?.expiry_bank} type="date" name="expiry_bank" value={formData.expiry_bank} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Issuing Branch</label>
                                                    <input disabled={selectedDD?.issuing_branch} name="issuing_branch" value={formData.issuing_branch} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter issuing branch" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Scan Copy <span className="text-red-500">*</span></label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" name="dd_scan_copy" onChange={handleFileChange} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold ${formData.type === "EPAYMENT" ? "file:bg-emerald-50 file:text-emerald-700" : "file:bg-blue-50 file:text-blue-700"}`} />
                                                        {formData.dd_scan_copy && typeof formData.dd_scan_copy === "string" && (
                                                            <button onClick={() => handleViewFile(formData.dd_scan_copy)} className={`p-2 rounded-lg ${formData.type === "EPAYMENT" ? "text-emerald-600 hover:bg-emerald-50" : "text-blue-600 hover:bg-blue-50"}`} title="View Scan Copy">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Receipt <span className="text-red-500">*</span></label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" name="dd_receipt" onChange={handleFileChange} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold ${formData.type === "EPAYMENT" ? "file:bg-emerald-50 file:text-emerald-700" : "file:bg-blue-50 file:text-blue-700"}`} />
                                                        {formData.dd_receipt && typeof formData.dd_receipt === "string" && (
                                                            <button onClick={() => handleViewFile(formData.dd_receipt)} className={`p-2 rounded-lg ${formData.type === "EPAYMENT" ? "text-emerald-600 hover:bg-emerald-50" : "text-blue-600 hover:bg-blue-50"}`} title="View Receipt">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    {formData.mode_of_payment === "BG" && (
                                        <>
                                            <div className="pt-4 border-t">
                                                <h3 className="text-sm font-bold text-gray-700 mb-3">BG Details</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                                    <input disabled={selectedDD?.bg_date} type="date" name="bg_date" value={formData.bg_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                                    <input disabled={selectedDD?.bg_amount} type="number" name="bg_amount" value={formData.bg_amount} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" placeholder="0.00" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">BG No</label>
                                                    <input disabled={selectedDD?.bg_number_field} name="bg_number_field" value={formData.bg_number_field} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" placeholder="Enter BG number" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Validity Upto</label>
                                                    <input disabled={selectedDD?.validity_upto} type="date" name="validity_upto" value={formData.validity_upto} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Client Name</label>
                                                    <input disabled={selectedDD?.client_name} name="client_name" value={formData.client_name} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" placeholder="Enter client name" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Scan Copy <span className="text-red-500">*</span></label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" name="bg_scan_copy" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700" />
                                                        {formData.bg_scan_copy && typeof formData.bg_scan_copy === "string" && (
                                                            <button onClick={() => handleViewFile(formData.bg_scan_copy)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Scan Copy">
                                                                <Eye size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    <div className={`bg-gray-50 p-4 rounded-lg space-y-4 ${formData.mode_of_payment === "DD" || formData.mode_of_payment === "BG" ? "" : "hidden"}`}>
                                        <h3 className="text-sm font-bold text-gray-700 mb-3">DD Issuance Details</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">DD Number (Unique)</label>
                                                <input disabled={!isAuthorized || selectedDD?.dd_number} name="dd_number" value={formData.dd_number} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none font-mono disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="DD123456" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Issued By</label>
                                                <input disabled={!isAuthorized} name="issued_by" value={formData.issued_by || formData.bank_name} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Bank Name from Step 2" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Upload Issued DD Copy</label>
                                            <div className="flex items-center gap-2">
                                                <input disabled={!isAuthorized} type="file" name="dd_upload" onChange={handleFileChange} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold ${formData.type === "EPAYMENT" ? "file:bg-emerald-50 file:text-emerald-700" : "file:bg-blue-50 file:text-blue-700"} disabled:opacity-50`} />
                                                {formData.dd_upload && typeof formData.dd_upload === "string" && (
                                                    <button onClick={() => handleViewFile(formData.dd_upload)} className={`p-2 rounded-lg flex items-center gap-1 text-xs font-bold ${formData.type === "EPAYMENT" ? "text-emerald-600 hover:bg-emerald-50" : "text-blue-600 hover:bg-blue-50"}`} title="View Final DD">
                                                        <Eye size={16} /> View
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                                            <div className="space-y-4">
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tracking</label>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Original DD Location</label>
                                                    <select disabled={!isAuthorized} name="original_dd_location" value={formData.original_dd_location} onChange={handleInputChange} className="p-2.5 border rounded-lg text-sm bg-gray-50 disabled:opacity-50">
                                                        <option value="Self">Self (At Office)</option>
                                                        <option value="Client">Client (Sent)</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input disabled={!isAuthorized} type="checkbox" id="claim_from_bank" name="claim_from_bank" checked={formData.claim_from_bank} onChange={handleClaimFromBankChange} className="w-4 h-4 text-blue-600 rounded disabled:opacity-50" />
                                                    <label htmlFor="claim_from_bank" className="text-sm font-medium text-gray-700">Claim from bank?</label>
                                                </div>
                                                {formData.original_dd_location === "Client" && (
                                                    <div className="space-y-4 pt-4 border-t">
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Client Tracking ID</label>
                                                            <input disabled={!isAuthorized} name="client_tracking_id" value={formData.client_tracking_id || ""} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} placeholder="Enter tracking ID" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Delivery Proof</label>
                                                            <div className="flex items-center gap-2">
                                                                <input disabled={!isAuthorized} type="file" name="delivery_proof" onChange={handleFileChange} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold ${formData.type === "EPAYMENT" ? "file:bg-emerald-50 file:text-emerald-700" : "file:bg-blue-50 file:text-blue-700"} disabled:opacity-50`} />
                                                                {formData.delivery_proof && typeof formData.delivery_proof === "string" && (
                                                                    <button onClick={() => handleViewFile(formData.delivery_proof)} className={`p-2 rounded-lg ${formData.type === "EPAYMENT" ? "text-emerald-600 hover:bg-emerald-50" : "text-blue-600 hover:bg-blue-50"}`} title="View Delivery Proof">
                                                                        <Eye size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Delivery Date</label>
                                                            <input disabled={!isAuthorized} type="date" name="delivery_date" value={formData.delivery_date || ""} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status Update</label>
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                            <label className="text-[10px] font-bold text-blue-400 uppercase">Workflow Status</label>
                                            <select disabled={!isAuthorized} name="status" value={formData.status} onChange={handleInputChange} className="w-full mt-2 p-2.5 border-blue-200 border rounded-lg text-sm bg-white font-bold text-blue-900 disabled:opacity-50">
                                                <option value="Assigned">Assigned</option>
                                                <option value="Filled">Filled</option>
                                                <option value="Issued">Issued</option>
                                                <option value="Sent to Client">Sent to Client</option>
                                                <option value="Claimed">Claimed</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filled By</label>
                                            <input disabled name="filled_by" value={formData.filled_by} className="w-full p-2.5 border rounded-lg bg-gray-100 cursor-not-allowed outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filled Date</label>
                                            <input disabled={selectedDD?.filled_date} type="date" name="filled_date" value={formData.filled_date} onChange={handleInputChange} className={`w-full p-2.5 border rounded-lg focus:ring-2 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${formData.type === "EPAYMENT" ? "focus:ring-emerald-500" : "focus:ring-blue-500"}`} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex justify-between">
                            <button onClick={() => setActiveModal(1)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"><ChevronLeft size={20} /> Back</button>
                            <div className="flex gap-3">
                                <button onClick={() => setActiveModal(null)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                                <button
                                    onClick={() => {
                                        handleSubmit(2, true); // Step 2 is now final for all types
                                    }}
                                    className={`flex items-center gap-2 ${formData.type === "BG" ? "bg-green-600 hover:bg-green-700" : formData.type === "EPAYMENT" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"} text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md`}
                                >
                                    <><CheckCircle size={20} /> Save & Complete</>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3 commented out - functionality moved to Step 2 */}
            {/* {activeModal === 3 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className="bg-green-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold">DD Issuance (Step 3)</h2>
                                <p className="text-xs opacity-80 mt-1">Provide final DD copy and tracking status</p>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-green-500 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            {!isAuthorized && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100">⚠️ Restricted: Admins/Accountants only.</div>}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">DD Number (Unique)</label>
                                    <input disabled={!isAuthorized || selectedDD?.dd_number} name="dd_number" value={formData.dd_number} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="DD123456" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Issued By</label>
                                    <input disabled={!isAuthorized} name="issued_by" value={formData.issued_by || (activeModal === 3 ? formData.bank_name : "")} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="Bank Name from Step 2" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Upload Issued DD Copy</label>
                                <div className="flex items-center gap-2">
                                    <input disabled={!isAuthorized} type="file" name="dd_upload" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-green-50 file:text-green-700 disabled:opacity-50" />
                                    {formData.dd_upload && typeof formData.dd_upload === "string" && (
                                        <button onClick={() => handleViewFile(formData.dd_upload)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-1 text-xs font-bold" title="View Final DD">
                                            <Eye size={16} /> View
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tracking</label>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Original DD Location</label>
                                        <select disabled={!isAuthorized} name="original_dd_location" value={formData.original_dd_location} onChange={handleInputChange} className="p-2.5 border rounded-lg text-sm bg-gray-50 disabled:opacity-50">
                                            <option value="Self">Self (At Office)</option>
                                            <option value="Client">Client (Sent)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input disabled={!isAuthorized} type="checkbox" id="claim_from_bank" name="claim_from_bank" checked={formData.claim_from_bank} onChange={handleInputChange} className="w-4 h-4 text-blue-600 rounded disabled:opacity-50" />
                                        <label htmlFor="claim_from_bank" className="text-sm font-medium text-gray-700">Claim from bank?</label>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status Update</label>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <label className="text-[10px] font-bold text-blue-400 uppercase">Workflow Status</label>
                                        <select disabled={!isAuthorized} name="status" value={formData.status} onChange={handleInputChange} className="w-full mt-2 p-2.5 border-blue-200 border rounded-lg text-sm bg-white font-bold text-blue-900 disabled:opacity-50">
                                            <option value="Assigned">Assigned</option>
                                            <option value="Filled">Filled</option>
                                            <option value="Issued">Issued</option>
                                            <option value="Sent to Client">Sent to Client</option>
                                            <option value="Claimed">Claimed</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex justify-between">
                            <button onClick={() => setActiveModal(2)} className="flex items-center gap-2 text-gray-500 font-bold hover:text-gray-900 transition-colors"><ChevronLeft size={20} /> Back to Step 2</button>
                            <div className="flex gap-3">
                                <button onClick={() => setActiveModal(null)} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors">Close</button>
                                {isAuthorized && (
                                    <button onClick={() => handleSubmit(3, true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md">
                                        <CheckCircle size={20} /> Save & Finish
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )} */}

            {/* Payment Modal */}
            {paymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold">Link Payment to DD #{selectedDD?.id}</h2>
                                <p className="text-xs opacity-80 mt-1">Select a debit statement to link</p>
                            </div>
                            <button onClick={() => setPaymentModalOpen(false)} className="p-2 hover:bg-emerald-500 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="mb-4 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <span className="text-xs font-medium text-emerald-600 uppercase">Net Amount:</span>
                                        <div className="text-lg font-bold text-emerald-900">₹{Number(selectedDD?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-emerald-600 uppercase">Total Linked:</span>
                                        <div className="text-lg font-bold text-emerald-900">₹{statements.filter(s => Number(s.dd_id) === Number(selectedDD?.id)).reduce((sum, s) => sum + Number(s.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-emerald-600 uppercase">Remaining:</span>
                                        <div className="text-lg font-bold text-emerald-900">₹{(Number(selectedDD?.amount || 0) - statements.filter(s => Number(s.dd_id) === Number(selectedDD?.id)).reduce((sum, s) => sum + Number(s.amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Search</label>
                                    <input
                                        type="text"
                                        value={paymentSearch}
                                        onChange={(e) => setPaymentSearch(e.target.value)}
                                        placeholder="Search by ID, Trans ID, Amount, or Type..."
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">From Date</label>
                                    <input
                                        type="date"
                                        value={paymentDateFrom}
                                        onChange={(e) => setPaymentDateFrom(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">To Date</label>
                                    <input
                                        type="date"
                                        value={paymentDateTo}
                                        onChange={(e) => setPaymentDateTo(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            {loadingStatements ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100 text-left">
                                            <tr>
                                                <th className="p-3 border-b font-semibold text-gray-700">ID</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Trans ID</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Date</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Description</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Amount</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Type</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {statements.filter(s => {
                                                const matchesType = s.type === "Debit";
                                                const matchesDD = !s.dd_id || Number(s.dd_id) === Number(selectedDD?.id);
                                                const matchesStatus = String(s.invoice_status || "").trim() !== "Settled";
                                                const matchesClientExpense = !s.client_expense_id;
                                                const matchesSearch = !paymentSearch || 
                                                    String(s.id) === paymentSearch ||
                                                    (s.trans_id && s.trans_id.toLowerCase().includes(paymentSearch.toLowerCase())) ||
                                                    String(s.amount || 0).includes(paymentSearch) ||
                                                    (s.date && new Date(s.date).toLocaleDateString().toLowerCase().includes(paymentSearch.toLowerCase())) ||
                                                    (s.type && s.type.toLowerCase().includes(paymentSearch.toLowerCase())) ||
                                                    (s.invoice_status && s.invoice_status.toLowerCase().includes(paymentSearch.toLowerCase()));
                                                const matchesDateFrom = !paymentDateFrom || (s.date && new Date(s.date) >= new Date(paymentDateFrom));
                                                const matchesDateTo = !paymentDateTo || (s.date && new Date(s.date) <= new Date(paymentDateTo));
                                                return matchesType && matchesDD && matchesStatus && matchesClientExpense && matchesSearch && matchesDateFrom && matchesDateTo;
                                            }).length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="p-10 text-center text-gray-500">No debit statements available</td>
                                                </tr>
                                            ) : (
                                                statements.filter(s => {
                                                    const matchesType = s.type === "Debit";
                                                    const matchesDD = !s.dd_id || Number(s.dd_id) === Number(selectedDD?.id);
                                                    const matchesStatus = String(s.invoice_status || "").trim() !== "Settled";
                                                    const matchesClientExpense = !s.client_expense_id;
                                                    const matchesSearch = !paymentSearch || 
                                                        String(s.id) === paymentSearch ||
                                                        (s.trans_id && s.trans_id.toLowerCase().includes(paymentSearch.toLowerCase())) ||
                                                        String(s.amount || 0).includes(paymentSearch) ||
                                                        (s.date && new Date(s.date).toLocaleDateString().toLowerCase().includes(paymentSearch.toLowerCase())) ||
                                                        (s.type && s.type.toLowerCase().includes(paymentSearch.toLowerCase())) ||
                                                        (s.invoice_status && s.invoice_status.toLowerCase().includes(paymentSearch.toLowerCase()));
                                                    const matchesDateFrom = !paymentDateFrom || (s.date && new Date(s.date) >= new Date(paymentDateFrom));
                                                    const matchesDateTo = !paymentDateTo || (s.date && new Date(s.date) <= new Date(paymentDateTo));
                                                    return matchesType && matchesDD && matchesStatus && matchesClientExpense && matchesSearch && matchesDateFrom && matchesDateTo;
                                                }).map((s) => (
                                                    <tr key={s.id} className="hover:bg-gray-50">
                                                        <td className="p-3 font-medium text-gray-600">#{s.id}</td>
                                                        <td className="p-3 font-mono text-xs text-gray-500">{s.trans_id || "—"}</td>
                                                        <td className="p-3 text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : "—"}</td>
                                                        <td className="p-3 max-w-[400px] truncate text-gray-600" title={s.description || ""}>{s.description || "—"}</td>
                                                        <td className="p-3 font-bold text-red-600">₹{Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.type === 'Debit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{s.type}</span>
                                                        </td>
                                                        <td className="p-3">
                                                            {Number(s.dd_id) === Number(selectedDD?.id) ? (
                                                                <button
                                                                    onClick={() => linkPayment(s.id, 'debit', 'unlink')}
                                                                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-semibold rounded transition-colors"
                                                                >
                                                                    Unlinked
                                                                </button>
                                                            ) : (
                                                                (() => {
                                                                    const hasLinkedPayment = statements.some(st => Number(st.dd_id) === Number(selectedDD?.id));
                                                                    return (
                                                                        <button
                                                                            onClick={() => linkPayment(s.id, 'debit')}
                                                                            disabled={hasLinkedPayment}
                                                                            className={`px-3 py-1.5 text-white text-xs font-semibold rounded transition-colors ${hasLinkedPayment ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                                                            title={hasLinkedPayment ? 'Only one payment can be linked' : ''}
                                                                        >
                                                                            Link Payment
                                                                        </button>
                                                                    );
                                                                })()
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                            <button
                                onClick={() => setPaymentModalOpen(false)}
                                className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Credit Modal */}
            {creditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold">Link Credit Payment to DD #{selectedDD?.id}</h2>
                                <p className="text-xs opacity-80 mt-1">Select an unsettled credit statement to link</p>
                            </div>
                            <button onClick={() => setCreditModalOpen(false)} className="p-2 hover:bg-blue-500 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <span className="text-xs font-medium text-blue-600 uppercase">Net Amount:</span>
                                        <div className="text-lg font-bold text-blue-900">₹{Number(selectedDD?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-blue-600 uppercase">Total Linked:</span>
                                        <div className="text-lg font-bold text-blue-900">₹{creditStatements.filter(s => Number(s.dd_id) === Number(selectedDD?.id)).reduce((sum, s) => sum + Number(s.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium text-blue-600 uppercase">Remaining:</span>
                                        <div className="text-lg font-bold text-blue-900">₹{(Number(selectedDD?.amount || 0) - creditStatements.filter(s => Number(s.dd_id) === Number(selectedDD?.id)).reduce((sum, s) => sum + Number(s.amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Search</label>
                                    <input
                                        type="text"
                                        value={creditSearch}
                                        onChange={(e) => setCreditSearch(e.target.value)}
                                        placeholder="Search by ID, Trans ID, Description, or Amount..."
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">From Date</label>
                                    <input
                                        type="date"
                                        value={creditDateFrom}
                                        onChange={(e) => setCreditDateFrom(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">To Date</label>
                                    <input
                                        type="date"
                                        value={creditDateTo}
                                        onChange={(e) => setCreditDateTo(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            {loadingCreditStatements ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100 text-left">
                                            <tr>
                                                <th className="p-3 border-b font-semibold text-gray-700">ID</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Trans ID</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Date</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Description</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Amount</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Type</th>
                                                <th className="p-3 border-b font-semibold text-gray-700">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {creditStatements.filter(s => {
                                                const matchesType = s.type === "Credit";
                                                const matchesDD = !s.dd_id || Number(s.dd_id) === Number(selectedDD?.id);
                                                const matchesStatus = String(s.invoice_status || "").trim() !== "Settled";
                                                const matchesClientExpense = !s.client_expense_id;
                                                const matchesSearch = !creditSearch || 
                                                    String(s.id) === creditSearch ||
                                                    (s.trans_id && s.trans_id.toLowerCase().includes(creditSearch.toLowerCase())) ||
                                                    String(s.amount || 0).includes(creditSearch) ||
                                                    (s.date && new Date(s.date).toLocaleDateString().toLowerCase().includes(creditSearch.toLowerCase())) ||
                                                    (s.type && s.type.toLowerCase().includes(creditSearch.toLowerCase())) ||
                                                    (s.invoice_status && s.invoice_status.toLowerCase().includes(creditSearch.toLowerCase()));
                                                const matchesDateFrom = !creditDateFrom || (s.date && new Date(s.date) >= new Date(creditDateFrom));
                                                const matchesDateTo = !creditDateTo || (s.date && new Date(s.date) <= new Date(creditDateTo));
                                                return matchesType && matchesDD && matchesStatus && matchesClientExpense && matchesSearch && matchesDateFrom && matchesDateTo;
                                            }).length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="p-10 text-center text-gray-500">No credit statements available</td>
                                                </tr>
                                            ) : (
                                                creditStatements.filter(s => {
                                                    const matchesType = s.type === "Credit";
                                                    const matchesDD = !s.dd_id || Number(s.dd_id) === Number(selectedDD?.id);
                                                    const matchesStatus = String(s.invoice_status || "").trim() !== "Settled";
                                                    const matchesClientExpense = !s.client_expense_id;
                                                    const matchesSearch = !creditSearch || 
                                                        String(s.id) === creditSearch ||
                                                        (s.trans_id && s.trans_id.toLowerCase().includes(creditSearch.toLowerCase())) ||
                                                        String(s.amount || 0).includes(creditSearch) ||
                                                        (s.date && new Date(s.date).toLocaleDateString().toLowerCase().includes(creditSearch.toLowerCase())) ||
                                                        (s.type && s.type.toLowerCase().includes(creditSearch.toLowerCase())) ||
                                                        (s.invoice_status && s.invoice_status.toLowerCase().includes(creditSearch.toLowerCase()));
                                                    const matchesDateFrom = !creditDateFrom || (s.date && new Date(s.date) >= new Date(creditDateFrom));
                                                    const matchesDateTo = !creditDateTo || (s.date && new Date(s.date) <= new Date(creditDateTo));
                                                    return matchesType && matchesDD && matchesStatus && matchesClientExpense && matchesSearch && matchesDateFrom && matchesDateTo;
                                                }).map((s) => (
                                                    <tr key={s.id} className="hover:bg-gray-50">
                                                        <td className="p-3 font-medium text-gray-600">#{s.id}</td>
                                                        <td className="p-3 font-mono text-xs text-gray-500">{s.trans_id || "—"}</td>
                                                        <td className="p-3 text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : "—"}</td>
                                                        <td className="p-3 max-w-[400px] truncate text-gray-600" title={s.description || ""}>{s.description || "—"}</td>
                                                        <td className="p-3 font-bold text-green-600">₹{Number(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.type === 'Debit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{s.type}</span>
                                                        </td>
                                                        <td className="p-3">
                                                            {Number(s.dd_id) === Number(selectedDD?.id) ? (
                                                                <button
                                                                    onClick={() => linkPayment(s.id, 'credit', 'unlink')}
                                                                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-semibold rounded transition-colors"
                                                                >
                                                                    Unlinked
                                                                </button>
                                                            ) : (
                                                                (() => {
                                                                    const hasLinkedPayment = creditStatements.some(st => Number(st.dd_id) === Number(selectedDD?.id));
                                                                    return (
                                                                        <button
                                                                            onClick={() => linkPayment(s.id, 'credit')}
                                                                            disabled={hasLinkedPayment}
                                                                            className={`px-3 py-1.5 text-white text-xs font-semibold rounded transition-colors ${hasLinkedPayment ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                                                            title={hasLinkedPayment ? 'Only one payment can be linked' : ''}
                                                                        >
                                                                            Link Payment
                                                                        </button>
                                                                    );
                                                                })()
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                            <button
                                onClick={() => setCreditModalOpen(false)}
                                className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
        
