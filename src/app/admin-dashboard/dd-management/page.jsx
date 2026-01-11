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
        Filled: "text-[12px] bg-yellow-100 text-yellow-700 border-yellow-200",
        Issued: "text-[12px] bg-green-100 text-green-700 border-green-200",
        "Sent to Client": "text-[12px] bg-purple-100 text-purple-700 border-purple-200",
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
            {status}
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

    const [activeModal, setActiveModal] = useState(null); // null, 0 (selection), 1, 2, or 3
    const [selectedDD, setSelectedDD] = useState(null);

    const isAuthorized = ["ADMIN", "SUPERADMIN", "ACCOUNTANT"].includes(userRole.toUpperCase());

    // Form State
    const [formData, setFormData] = useState({
        type: "DD", // "DD" or "BG"
        dd_location: "",
        party_name: "",
        amount: "",
        assign_date: dayjs().format("YYYY-MM-DD"),
        assigned_by: "",

        // BG Specific Step 1
        beneficiary_name: "",
        beneficiary_address: "",
        expiry_date: "",
        claim_expiry_date: "",
        bg_format_upload: null,

        cheque_no: "",
        cheque_upload: null,
        bank_name: "",
        account_number: "",
        branch: "",
        signature_upload: null,
        filled_by: "",
        filled_date: dayjs().format("YYYY-MM-DD"),

        // BG Specific Step 2
        fd_number: "",
        original_bg_upload: null,
        bg_number: "",
        docs_upload: null,

        dd_upload: null,
        dd_number: "",
        issued_by: "",

        status: "Assigned",
        original_dd_location: "Self",
        sent_to_client_date: "",
        claim_from_bank: false
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
        if (formData.cheque_upload instanceof File) { fileData.append("cheque_upload", formData.cheque_upload); hasFiles = true; }
        if (formData.signature_upload instanceof File) { fileData.append("signature_upload", formData.signature_upload); hasFiles = true; }
        if (formData.dd_upload instanceof File) { fileData.append("dd_upload", formData.dd_upload); hasFiles = true; }
        if (formData.bg_format_upload instanceof File) { fileData.append("bg_format_upload", formData.bg_format_upload); hasFiles = true; }
        if (formData.original_bg_upload instanceof File) { fileData.append("original_bg_upload", formData.original_bg_upload); hasFiles = true; }
        if (formData.docs_upload instanceof File) { fileData.append("docs_upload", formData.docs_upload); hasFiles = true; }

        if (!hasFiles) return {};

        const res = await fetch("/api/dd-management/upload", {
            method: "POST",
            body: fileData
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Upload failed");
        return result.paths;
    };

    const handleSubmit = async (step, shouldClose = true) => {
        try {
            const uploadedPaths = await uploadFiles();

            const payload = { ...formData, ...uploadedPaths };
            // Clean up File objects (only if they haven't been replaced by string paths)
            if (payload.cheque_upload instanceof File) delete payload.cheque_upload;
            if (payload.signature_upload instanceof File) delete payload.signature_upload;
            if (payload.dd_upload instanceof File) delete payload.dd_upload;

            // Automation: Update status based on the step being saved if it's currently at an earlier stage
            if (step === 1) {
                if (payload.type === "BG") {
                    if (!payload.status || payload.status === "Assigned") payload.status = "Filled";
                } else {
                    if (!payload.status || payload.status === "Assigned") payload.status = "Assigned"; // For DD, Step 1 is just Assignment
                }
            } else if (step === 2) {
                if (!payload.filled_by) payload.filled_by = currentUserName;
                if (payload.type === "BG") {
                    payload.status = "Issued"; // BG is complete at Step 2
                } else {
                    if (payload.status === "Assigned") payload.status = "Filled";
                }
            } else if (step === 3) {
                if (payload.status === "Filled") payload.status = "Issued";
                if (!payload.issued_by) payload.issued_by = payload.bank_name || "";
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
                } else if (isAuthorized && step < 3) {
                    // Transition to next modal
                    setActiveModal(step + 1);
                } else {
                    setActiveModal(null);
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
            setActiveModal(0); // Show selection first for new records
            return;
        }
        setSelectedDD(dd);
        if (dd) {
            setFormData({
                ...dd,
                filled_by: (step === 2 && !dd.filled_by) ? currentUserName : dd.filled_by,
                assign_date: dd.assign_date ? dayjs(dd.assign_date).format("YYYY-MM-DD") : "",
                filled_date: dd.filled_date ? dayjs(dd.filled_date).format("YYYY-MM-DD") : "",
                sent_to_client_date: dd.sent_to_client_date ? dayjs(dd.sent_to_client_date).format("YYYY-MM-DD") : "",
                expiry_date: dd.expiry_date ? dayjs(dd.expiry_date).format("YYYY-MM-DD") : "",
                claim_expiry_date: dd.claim_expiry_date ? dayjs(dd.claim_expiry_date).format("YYYY-MM-DD") : "",
                claim_from_bank: !!dd.claim_from_bank,
                cheque_upload: dd.cheque_upload,
                signature_upload: dd.signature_upload,
                dd_upload: dd.dd_upload,
                bg_format_upload: dd.bg_format_upload,
                original_bg_upload: dd.original_bg_upload,
                docs_upload: dd.docs_upload
            });
        } else {
            resetForm();
        }
        setActiveModal(step);
    };

    const resetForm = () => {
        setSelectedDD(null);
        setActiveModal(null);
        setFormData({
            type: "DD",
            dd_location: "",
            party_name: "",
            amount: "",
            assign_date: dayjs().format("YYYY-MM-DD"),
            assigned_by: "",
            beneficiary_name: "",
            beneficiary_address: "",
            expiry_date: "",
            claim_expiry_date: "",
            bg_format_upload: null,
            cheque_no: "",
            cheque_upload: null,
            bank_name: "",
            account_number: "",
            branch: "",
            signature_upload: null,
            filled_by: "",
            filled_date: dayjs().format("YYYY-MM-DD"),
            fd_number: "",
            original_bg_upload: null,
            bg_number: "",
            docs_upload: null,
            dd_upload: null,
            dd_number: "",
            issued_by: "",
            status: "Assigned",
            original_dd_location: "Self",
            sent_to_client_date: "",
            claim_from_bank: false
        });
        fetchUser(); // Refresh pre-fill from session
    };
    const handleViewFile = (filePath) => {
        if (!filePath) return;
        window.open(filePath, "_blank");
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
                                                <div className={`w-10 h-10 rounded-xl ${dd.type === 'BG' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'} flex items-center justify-center font-bold shadow-sm group-hover:scale-110 transition-transform`}>
                                                    {dd.type === 'BG' ? 'BG' : 'DD'}
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
                                            <div className="text-[12px] text-gray-400 mt-1 capitalize">
                                                Loc: {dd.original_dd_location}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    disabled={!!dd.claim_from_bank}
                                                    checked={!!dd.claim_from_bank}
                                                    onChange={async (e) => {
                                                        const newVal = e.target.checked;
                                                        try {
                                                            const res = await fetch(`/api/dd-management/${dd.id}`, {
                                                                method: 'PUT',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ claim_from_bank: newVal })
                                                            });
                                                            if (res.ok) {
                                                                toast.success("Claim status updated and locked");
                                                                fetchData();
                                                            }
                                                        } catch (error) {
                                                            toast.error("Failed to update claim status");
                                                        }
                                                    }}
                                                    className={`w-4 h-4 text-blue-600 rounded focus:ring-blue-500 ${dd.claim_from_bank ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                                                />
                                                <span className={`text-xs font-medium ${dd.claim_from_bank ? "text-blue-700" : "text-gray-600"}`}>{dd.claim_from_bank ? "Yes" : "No"}</span>
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
                                                        {dd.type === 'DD' && (
                                                            <button
                                                                onClick={() => openStepModal(dd, 3)}
                                                                className="p-1 px-2 text-green-600 hover:bg-green-50 rounded border border-green-100 transition-colors text-[10px] font-bold"
                                                                title="Step 3: Issuance"
                                                            >
                                                                Step 3
                                                            </button>
                                                        )}
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
                                onClick={() => { setFormData(prev => ({ ...prev, type: "DD" })); setActiveModal(1); }}
                                className="w-full py-4 bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition-all flex flex-col items-center gap-2"
                            >
                                <FileText size={32} />
                                Demand Draft (DD)
                            </button>
                            <button
                                onClick={() => { setFormData(prev => ({ ...prev, type: "BG" })); setActiveModal(1); }}
                                className="w-full py-4 bg-purple-50 text-purple-700 border-2 border-purple-200 rounded-xl font-bold hover:bg-purple-100 transition-all flex flex-col items-center gap-2"
                            >
                                <CheckCircle size={32} />
                                Bank Guarantee (BG)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 1 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className={`${formData.type === "BG" ? "bg-purple-600" : "bg-blue-600"} p-6 text-white flex justify-between items-center`}>
                            <div>
                                <h2 className="text-xl font-bold">
                                    {selectedDD ? `Edit ${formData.type} (Step 1)` : `New ${formData.type} Assignment`}
                                </h2>
                                <p className="text-xs opacity-80 mt-1">Manage basic {formData.type} details</p>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-black/20 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-4">
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
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Upload BG Format</label>
                                        <div className="flex items-center gap-2">
                                            <input disabled={!isAuthorized} type="file" name="bg_format_upload" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 disabled:opacity-50" />
                                            {formData.bg_format_upload && typeof formData.bg_format_upload === "string" && (
                                                <button onClick={() => handleViewFile(formData.bg_format_upload)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg flex items-center gap-1 text-xs font-bold" title="View BG Format">
                                                    <Eye size={16} /> View
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">DD Location</label>
                                            <input disabled={selectedDD?.dd_location} name="dd_location" value={formData.dd_location} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="e.g. Mumbai Main Branch" />
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Party Name (Favour)</label>
                                            <input disabled={selectedDD?.party_name} name="party_name" value={formData.party_name} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="Enter party name" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                            <input disabled={selectedDD?.amount} type="number" name="amount" value={formData.amount} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="0.00" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assign Date</label>
                                            <input disabled={selectedDD?.assign_date} type="date" name="assign_date" value={formData.assign_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" />
                                        </div>
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
                                    className={`flex items-center gap-2 ${formData.type === "BG" ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"} text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md`}
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
                        <div className={`${formData.type === "BG" ? "bg-purple-600" : "bg-blue-600"} p-6 text-white flex justify-between items-center`}>
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cheque Number</label>
                                            <input disabled={selectedDD?.cheque_no} name="cheque_no" value={formData.cheque_no} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="6-digit number" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Upload Cheque Copy</label>
                                            <div className="flex items-center gap-2">
                                                <input disabled={!isAuthorized} type="file" name="cheque_upload" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 disabled:opacity-50" />
                                                {formData.cheque_upload && typeof formData.cheque_upload === "string" && (
                                                    <button onClick={() => handleViewFile(formData.cheque_upload)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1 text-xs font-bold" title="View Cheque">
                                                        <Eye size={16} /> View
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Bank Name</label>
                                            <input disabled={selectedDD?.bank_name} name="bank_name" value={formData.bank_name} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="e.g. SBI, HDFC" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Number</label>
                                            <input disabled={selectedDD?.account_number} name="account_number" value={formData.account_number} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="Full account number" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Branch</label>
                                            <input disabled={selectedDD?.branch} name="branch" value={formData.branch} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder="Branch location" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Signature Upload</label>
                                            <div className="flex items-center gap-2">
                                                <input disabled={!isAuthorized} type="file" name="signature_upload" onChange={handleFileChange} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 disabled:opacity-50" />
                                                {formData.signature_upload && typeof formData.signature_upload === "string" && (
                                                    <button onClick={() => handleViewFile(formData.signature_upload)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1 text-xs font-bold" title="View Signature">
                                                        <Eye size={16} /> View
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filled By</label>
                                            <input disabled name="filled_by" value={formData.filled_by} className="w-full p-2.5 border rounded-lg bg-gray-100 cursor-not-allowed outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Filled Date</label>
                                            <input disabled={selectedDD?.filled_date} type="date" name="filled_date" value={formData.filled_date} onChange={handleInputChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" />
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
                                        if (formData.type === "DD") {
                                            if (!formData.cheque_no || !formData.bank_name || !formData.account_number) {
                                                toast.error("Required: Cheque No, Bank, Account"); return;
                                            }
                                        } else {
                                            if (!formData.bg_number || !formData.bank_name || !formData.fd_number) {
                                                toast.error("Required: BG No, Bank, FD No"); return;
                                            }
                                        }
                                        handleSubmit(2, formData.type === "BG"); // For BG, step 2 is final
                                    }}
                                    className={`flex items-center gap-2 ${formData.type === "BG" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"} text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-md`}
                                >
                                    {formData.type === "BG" ? (
                                        <><CheckCircle size={20} /> Complete BG</>
                                    ) : (
                                        <>Save & Next <ChevronRight size={20} /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 3 && (
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
                                    <input disabled name="issued_by" value={formData.issued_by || (activeModal === 3 ? formData.bank_name : "")} className="w-full p-2.5 border rounded-lg bg-gray-100 cursor-not-allowed outline-none" placeholder="Bank Name from Step 2" />
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
            )}
        </div>
    );
}
