"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { format } from "date-fns";
import { Loader2, Users, CheckSquare, Square, ChevronDown, Search } from "lucide-react";
import { NOTES_LANGUAGE_OPTIONS } from "@/constants/notesLanguageOptions";

const LEAD_TYPE_OPTIONS = [
    { key: "all", label: "All", field: null },
    { key: "sales", label: "Sales", field: "lead_source" },
    { key: "service", label: "Service", field: "service_lead_source" },
    { key: "gem", label: "GEM", field: "gem_lead_source" },
];

const LEAD_SOURCE_GROUP_ORDER = ["sales", "service", "gem"];
const LEAD_SOURCE_GROUP_LABELS = {
    sales: "Sales",
    service: "Service",
    gem: "GEM",
};

function hasLeadValue(value) {
    return value != null && String(value).trim() !== "";
}

function getLeadSourceDisplay(customer, leadType) {
    const config = LEAD_TYPE_OPTIONS.find((t) => t.key === leadType);
    if (!config?.field) {
        const parts = [];
        if (hasLeadValue(customer.lead_source)) parts.push(`Sales: ${String(customer.lead_source).trim()}`);
        if (hasLeadValue(customer.service_lead_source)) parts.push(`Service: ${String(customer.service_lead_source).trim()}`);
        if (hasLeadValue(customer.gem_lead_source)) parts.push(`GEM: ${String(customer.gem_lead_source).trim()}`);
        return parts.length ? parts.join(" | ") : "—";
    }
    const value = customer[config.field];
    return hasLeadValue(value) ? String(value).trim() : "—";
}

function getCustomerLeadTypes(customer) {
    const types = [];
    if (hasLeadValue(customer.lead_source)) types.push("sales");
    if (hasLeadValue(customer.service_lead_source)) types.push("service");
    if (hasLeadValue(customer.gem_lead_source)) types.push("gem");
    return types;
}

function customerMatchesLeadType(customer, leadType) {
    if (leadType === "all") {
        return getCustomerLeadTypes(customer).length > 0;
    }
    const config = LEAD_TYPE_OPTIONS.find((t) => t.key === leadType);
    return config?.field ? hasLeadValue(customer[config.field]) : false;
}

// Searchable Dropdown Component
function SearchableDropdown({ options, value, onChange, placeholder, className = "", grouped = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter((option) => {
        const q = searchTerm.toLowerCase();
        const username = String(option.username || "").toLowerCase();
        const groupLabel = String(LEAD_SOURCE_GROUP_LABELS[option.leadType] || "").toLowerCase();
        return username.includes(q) || groupLabel.includes(q);
    });

    const groupedSections = grouped
        ? LEAD_SOURCE_GROUP_ORDER.map((type) => ({
            type,
            label: LEAD_SOURCE_GROUP_LABELS[type],
            options: filteredOptions.filter((option) => option.leadType === type),
        })).filter((section) => section.options.length > 0)
        : [];

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm("");
    };

    const selectedOption = options.find(opt => opt.username === value);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div
                className="border rounded px-3 py-2 cursor-pointer bg-white flex items-center justify-between"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={value ? "text-gray-900" : "text-gray-500"}>
                    {selectedOption ? selectedOption.username : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto">
                        <div
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-500"
                            onClick={() => handleSelect("")}
                        >
                            {placeholder}
                        </div>
                        {grouped ? (
                            groupedSections.map((section) => (
                                <div key={section.type}>
                                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-y border-gray-100">
                                        {section.label}
                                    </div>
                                    {section.options.map((option) => (
                                        <div
                                            key={`${section.type}-${option.username}`}
                                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => handleSelect(option.username)}
                                        >
                                            {option.username}
                                        </div>
                                    ))}
                                </div>
                            ))
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.username}
                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                    onClick={() => handleSelect(option.username)}
                                >
                                    {option.username}
                                </div>
                            ))
                        )}
                        {filteredOptions.length === 0 && searchTerm && (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BulkReassignTable() {
    const [allCustomers, setAllCustomers] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const tableRef = useRef(null);

    const [hasApplied, setHasApplied] = useState(false);
    const [leadTypeFilter, setLeadTypeFilter] = useState("all");
    const [leadSourceFilter, setLeadSourceFilter] = useState("");
    const [appliedLeadType, setAppliedLeadType] = useState("all");
    const [appliedLeadSource, setAppliedLeadSource] = useState("");

    const [filters, setFilters] = useState({
        status: "",
        tags: "",
        stage: "",
        lead_campaign: "",
        products_interest: "",
        notes_language: "",
    });

    const [employees, setEmployees] = useState([]);
    const [targetEmployee, setTargetEmployee] = useState("");
    const [bulkLeadType, setBulkLeadType] = useState("sales");

    const activeLeadTypeConfig = LEAD_TYPE_OPTIONS.find((t) => t.key === leadTypeFilter) || LEAD_TYPE_OPTIONS[0];
    const appliedLeadTypeConfig = LEAD_TYPE_OPTIONS.find((t) => t.key === appliedLeadType) || LEAD_TYPE_OPTIONS[0];
    const bulkType = appliedLeadType === "all" ? bulkLeadType : appliedLeadType;

    // All: one row per assignment (Sales / Service / GEM). Other filters: one row if that column is set.
    const displayRows = useMemo(() => {
        if (!hasApplied) return [];

        const rows = [];

        if (appliedLeadType === "all") {
            allCustomers.forEach((customer) => {
                getCustomerLeadTypes(customer).forEach((typeKey) => {
                    const typeConfig = LEAD_TYPE_OPTIONS.find((t) => t.key === typeKey);
                    if (appliedLeadSource && typeConfig?.field) {
                        const value = customer[typeConfig.field];
                        if (!hasLeadValue(value) || String(value).trim() !== appliedLeadSource) {
                            return;
                        }
                    }
                    rows.push({
                        customer,
                        typeKey,
                        rowKey: `${customer.customer_id}-${typeKey}`,
                    });
                });
            });
            return rows;
        }

        const sourceField = appliedLeadTypeConfig.field;
        allCustomers.forEach((customer) => {
            if (!customerMatchesLeadType(customer, appliedLeadType)) return;
            if (appliedLeadSource && sourceField) {
                const value = customer[sourceField];
                if (!hasLeadValue(value) || String(value).trim() !== appliedLeadSource) return;
            }
            rows.push({
                customer,
                typeKey: appliedLeadType,
                rowKey: `${customer.customer_id}-${appliedLeadType}`,
            });
        });
        return rows;
    }, [allCustomers, appliedLeadType, appliedLeadSource, appliedLeadTypeConfig.field, hasApplied]);

    const visibleCustomerIds = useMemo(
        () => [...new Set(displayRows.map((row) => row.customer.customer_id))],
        [displayRows],
    );

    const allVisibleSelected =
        visibleCustomerIds.length > 0 &&
        visibleCustomerIds.every((id) => selectedCustomers.has(id));

    const [filterLeadSources, setFilterLeadSources] = useState([]);

    useEffect(() => {
        const fetchLeadSources = async (type) => {
            try {
                const response = await fetch(`/api/lead-sources?type=${type}`);
                const data = await response.json();
                if (data.success) return data.employees || [];
            } catch (error) {
                console.error("Error fetching lead sources:", error);
            }
            return [];
        };

        fetchLeadSources(leadTypeFilter).then(setFilterLeadSources);
    }, [leadTypeFilter]);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await fetch(`/api/lead-sources?type=${bulkType}`);
                const data = await response.json();
                if (data.success) setEmployees(data.employees || []);
            } catch (error) {
                console.error("Error fetching employees:", error);
            }
        };
        fetchEmployees();
        setTargetEmployee("");
    }, [bulkType]);

    const handleApplyFilters = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const response = await fetch(`/api/bulk-leads-data?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setAllCustomers(data.customers || []);
                setAppliedLeadType(leadTypeFilter);
                setAppliedLeadSource(leadSourceFilter);
                setHasApplied(true);
                setSelectedCustomers(new Set());
                setFocusedIndex(0);
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
            alert("Failed to fetch customers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLeadSourceFilter("");
    }, [leadTypeFilter]);

    const handleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedCustomers(new Set());
        } else {
            setSelectedCustomers(new Set(visibleCustomerIds));
        }
    };

    const toggleCustomerSelection = (customerId) => {
        const newSelection = new Set(selectedCustomers);
        if (newSelection.has(customerId)) {
            newSelection.delete(customerId);
        } else {
            newSelection.add(customerId);
        }
        setSelectedCustomers(newSelection);
    };

    const handleKeyDown = useCallback((e) => {
        if (displayRows.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, displayRows.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                break;
            case " ":
                e.preventDefault();
                if (displayRows[focusedIndex]) {
                    toggleCustomerSelection(displayRows[focusedIndex].customer.customer_id);
                }
                break;
            case "a":
                if (e.ctrlKey) {
                    e.preventDefault();
                    handleSelectAll();
                }
                break;
        }
    }, [displayRows, focusedIndex]);

    useEffect(() => {
        const table = tableRef.current;
        if (table) {
            table.addEventListener("keydown", handleKeyDown);
            return () => table.removeEventListener("keydown", handleKeyDown);
        }
    }, [handleKeyDown]);

    const handleBulkReassign = async () => {
        if (selectedCustomers.size === 0) {
            alert("Please select at least one customer");
            return;
        }

        if (!targetEmployee) {
            alert("Please select a target employee");
            return;
        }

        const typeLabel = LEAD_TYPE_OPTIONS.find((t) => t.key === bulkType)?.label || "Sales";
        const confirmed = confirm(
            `Are you sure you want to reassign ${selectedCustomers.size} ${typeLabel} lead(s) to ${targetEmployee}?`
        );

        if (!confirmed) return;

        setSubmitting(true);
        try {
            const response = await fetch("/api/bulk-assign-leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer_ids: Array.from(selectedCustomers),
                    employee_username: targetEmployee,
                    lead_type: bulkType,
                }),
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                handleApplyFilters();
                setTargetEmployee("");
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Error performing bulk reassignment:", error);
            alert("Failed to perform bulk reassignment");
        } finally {
            setSubmitting(false);
        }
    };

    const leadSourceColumnLabel = appliedLeadType === "all"
        ? "Lead Source"
        : `${appliedLeadTypeConfig.label} Lead Source`;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Filter Leads
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Lead Type</label>
                        <select
                            value={leadTypeFilter}
                            onChange={(e) => setLeadTypeFilter(e.target.value)}
                            className="border rounded px-3 py-2 w-full"
                        >
                            {LEAD_TYPE_OPTIONS.map((option) => (
                                <option key={option.key} value={option.key}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="border rounded px-3 py-2"
                    >
                        <option value="">All Status</option>
                        <option value="New">New</option>
                        <option value="verygud">Very Good</option>
                        <option value="average">Average</option>
                        <option value="poor">Poor</option>
                        <option value="denied">Denied</option>
                        <option value="old_reassign">Old Reassign</option>
                    </select>

                    <select
                        value={filters.stage}
                        onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
                        className="border rounded px-3 py-2"
                    >
                        <option value="">All Stages</option>
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Interested">Interested</option>
                        <option value="Demo Scheduled">Demo Scheduled</option>
                        <option value="Demo Completed">Demo Completed</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Quotation Sent">Quotation Sent</option>
                        <option value="Quotation Revised">Quotation Revised</option>
                        <option value="Negotiation / Follow-up">Negotiation / Follow-up</option>
                        <option value="Decision Pending">Decision Pending</option>
                        <option value="Won (Order Received)">Won (Order Received)</option>
                        <option value="Lost">Lost</option>
                        <option value="Disqualified / Invalid Lead">Disqualified / Invalid Lead</option>
                    </select>

                    <select
                        value={filters.lead_campaign}
                        onChange={(e) => setFilters({ ...filters, lead_campaign: e.target.value })}
                        className="border rounded px-3 py-2"
                    >
                        <option value="">All Lead Campaigns</option>
                        <option value="india_mart">India Mart</option>
                        <option value="social_media">Social Media</option>
                        <option value="google_ads">Google Ads</option>
                        <option value="visit">Visit</option>
                        <option value="reference">Reference</option>
                    </select>

                    <input
                        type="text"
                        placeholder="Filter by tags..."
                        value={filters.tags}
                        onChange={(e) => setFilters({ ...filters, tags: e.target.value })}
                        className="border rounded px-3 py-2"
                    />

                    <input
                        type="text"
                        placeholder="Filter by product category..."
                        value={filters.products_interest}
                        onChange={(e) => setFilters({ ...filters, products_interest: e.target.value })}
                        className="border rounded px-3 py-2"
                    />

                    <select
                        value={filters.notes_language}
                        onChange={(e) => setFilters({ ...filters, notes_language: e.target.value })}
                        className="border rounded px-3 py-2"
                    >
                        <option value="">All Language</option>
                        {NOTES_LANGUAGE_OPTIONS.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                                {lang.name}
                            </option>
                        ))}
                    </select>

                    <SearchableDropdown
                        options={filterLeadSources}
                        value={leadSourceFilter}
                        onChange={setLeadSourceFilter}
                        grouped={leadTypeFilter === "all"}
                        placeholder={
                            leadTypeFilter === "all"
                                ? "All Lead Sources"
                                : `All ${activeLeadTypeConfig.label} Lead Sources`
                        }
                        className="w-full"
                    />
                </div>

                <button
                    onClick={handleApplyFilters}
                    disabled={loading}
                    className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading ? "Loading..." : "Apply Filters"}
                </button>
            </div>

            {hasApplied && displayRows.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-4">Bulk Reassignment</h3>

                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        {appliedLeadType === "all" && (
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Lead Type to Change
                                </label>
                                <select
                                    value={bulkLeadType}
                                    onChange={(e) => {
                                        setBulkLeadType(e.target.value);
                                        setTargetEmployee("");
                                    }}
                                    className="w-full border rounded px-3 py-2"
                                >
                                    <option value="sales">Sales</option>
                                    <option value="service">Service</option>
                                    <option value="gem">GEM</option>
                                </select>
                            </div>
                        )}

                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                New {LEAD_TYPE_OPTIONS.find((t) => t.key === bulkType)?.label} Lead Source
                            </label>
                            <SearchableDropdown
                                options={employees}
                                value={targetEmployee}
                                onChange={setTargetEmployee}
                                placeholder="-- Select Employee --"
                                className="w-full"
                            />
                        </div>

                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Selected: {selectedCustomers.size} / {visibleCustomerIds.length}
                            </label>
                            <button
                                onClick={handleBulkReassign}
                                disabled={submitting || selectedCustomers.size === 0 || !targetEmployee}
                                className="w-full px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {submitting ? "Reassigning..." : `Reassign ${selectedCustomers.size} Lead(s)`}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                        <p><strong>Keyboard shortcuts:</strong></p>
                        <ul className="list-disc list-inside mt-1">
                            <li>Arrow Up/Down: Navigate rows</li>
                            <li>Space: Toggle selection</li>
                            <li>Ctrl+A: Select all</li>
                        </ul>
                    </div>
                </div>
            )}

            {hasApplied && displayRows.length > 0 && (
                <div
                    ref={tableRef}
                    tabIndex={0}
                    className="bg-white rounded-lg shadow-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
                        <button
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                        >
                            {allVisibleSelected ? (
                                <CheckSquare className="w-5 h-5" />
                            ) : (
                                <Square className="w-5 h-5" />
                            )}
                            {allVisibleSelected ? "Deselect All" : "Select All"}
                        </button>
                        <span className="text-sm text-gray-600">
                            Showing: {displayRows.length} rows ({visibleCustomerIds.length} customers) / {allCustomers.length} loaded
                        </span>
                    </div>

                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                        Select
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                        Customer
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                        Lead Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                        {leadSourceColumnLabel}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                        Stage
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                        Tags
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                                        Date Created
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayRows.map((row, index) => {
                                    const customer = row.customer;
                                    const typeLabel =
                                        LEAD_TYPE_OPTIONS.find((t) => t.key === row.typeKey)?.label || row.typeKey;

                                    return (
                                    <tr
                                        key={row.rowKey}
                                        className={`
                      cursor-pointer transition-colors
                      ${selectedCustomers.has(customer.customer_id) ? "bg-blue-50" : "hover:bg-gray-50"}
                      ${focusedIndex === index ? "ring-2 ring-blue-400" : ""}
                    `}
                                        onClick={() => toggleCustomerSelection(customer.customer_id)}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomers.has(customer.customer_id)}
                                                onChange={() => toggleCustomerSelection(customer.customer_id)}
                                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900">
                                                {customer.first_name} {customer.last_name}
                                            </div>
                                            <div className="text-sm text-gray-500">{customer.phone}</div>
                                            <div className="text-xs text-gray-400">ID: {customer.customer_id}</div>
                                            {customer.email && (
                                                <div className="text-xs text-gray-400">{customer.email}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                                            {typeLabel}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-blue-700">
                                            {getLeadSourceDisplay(customer, row.typeKey)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100">
                                                {customer.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{customer.stage}</td>
                                        <td className="px-4 py-3 text-sm">{customer.tags || "—"}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {customer.date_created && !isNaN(new Date(customer.date_created))
                                                ? format(new Date(customer.date_created), "dd MMM yyyy")
                                                : "—"}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && !hasApplied && (
                <div className="bg-white p-12 rounded-lg shadow-md text-center text-gray-500">
                    <p className="text-lg">Apply filters to load leads.</p>
                </div>
            )}

            {!loading && hasApplied && allCustomers.length === 0 && (
                <div className="bg-white p-12 rounded-lg shadow-md text-center text-gray-500">
                    <p className="text-lg">No customers found for selected filters.</p>
                </div>
            )}

            {!loading && hasApplied && allCustomers.length > 0 && displayRows.length === 0 && (
                <div className="bg-white p-12 rounded-lg shadow-md text-center text-gray-500">
                    <p className="text-lg">No leads found for selected lead type.</p>
                </div>
            )}
        </div>
    );
}
