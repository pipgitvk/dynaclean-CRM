"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { Loader2, Users, CheckSquare, Square } from "lucide-react";

export default function BulkReassignTable() {
    const [customers, setCustomers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const tableRef = useRef(null);

    // Filters
    const [filters, setFilters] = useState({
        status: "",
        tags: "",
        stage: "",
        lead_source: "",
        lead_campaign: "",
        products_interest: "",
    });

    // Target employee for reassignment
    const [targetEmployee, setTargetEmployee] = useState("");

    // Fetch employees on mount
    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await fetch("/api/tl-assign-lead");
            const data = await response.json();
            if (data.success) {
                setEmployees(data.employees);
            }
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const response = await fetch(`/api/bulk-leads-data?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setCustomers(data.customers);
                setSelectedCustomers(new Set()); // Clear selection on new fetch
                setFocusedIndex(0);
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
            alert("Failed to fetch customers");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedCustomers.size === customers.length) {
            setSelectedCustomers(new Set());
        } else {
            setSelectedCustomers(new Set(customers.map(c => c.customer_id)));
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
        if (customers.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, customers.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
                break;
            case " ":
                e.preventDefault();
                if (customers[focusedIndex]) {
                    toggleCustomerSelection(customers[focusedIndex].customer_id);
                }
                break;
            case "a":
                if (e.ctrlKey) {
                    e.preventDefault();
                    handleSelectAll();
                }
                break;
        }
    }, [customers, focusedIndex]);

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

        const confirmed = confirm(
            `Are you sure you want to reassign ${selectedCustomers.size} lead(s) to ${targetEmployee}?`
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
                }),
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                // Refresh the customer list
                fetchCustomers();
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

    return (
        <div className="space-y-6">
            {/* Filter Section */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Filter Leads
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                        value={filters.lead_source}
                        onChange={(e) => setFilters({ ...filters, lead_source: e.target.value })}
                        className="border rounded px-3 py-2"
                    >
                        <option value="">All Employees</option>
                        {employees.map((emp) => (
                            <option key={emp.username} value={emp.username}>
                                {emp.username}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={fetchCustomers}
                    disabled={loading}
                    className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading ? "Loading..." : "Apply Filters"}
                </button>
            </div>

            {/* Bulk Action Section */}
            {customers.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold mb-4">Bulk Reassignment</h3>

                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Target Employee
                            </label>
                            <select
                                value={targetEmployee}
                                onChange={(e) => setTargetEmployee(e.target.value)}
                                className="w-full border rounded px-3 py-2"
                            >
                                <option value="">-- Select Employee --</option>
                                {employees.map((emp) => (
                                    <option key={emp.username} value={emp.username}>
                                        {emp.username}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Selected: {selectedCustomers.size} / {customers.length}
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

            {/* Customer Table */}
            {customers.length > 0 && (
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
                            {selectedCustomers.size === customers.length ? (
                                <CheckSquare className="w-5 h-5" />
                            ) : (
                                <Square className="w-5 h-5" />
                            )}
                            {selectedCustomers.size === customers.length ? "Deselect All" : "Select All"}
                        </button>
                        <span className="text-sm text-gray-600">
                            Total: {customers.length} leads
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
                                        Assigned To
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
                                {customers.map((customer, index) => (
                                    <tr
                                        key={customer.customer_id}
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
                                            {customer.email && (
                                                <div className="text-xs text-gray-400">{customer.email}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{customer.lead_source}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100">
                                                {customer.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{customer.stage}</td>
                                        <td className="px-4 py-3 text-sm">{customer.tags || "—"}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {format(new Date(customer.date_created), "dd MMM yyyy")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && customers.length === 0 && (
                <div className="bg-white p-12 rounded-lg shadow-md text-center text-gray-500">
                    <p className="text-lg">No customers found. Apply filters to load leads.</p>
                </div>
            )}
        </div>
    );
}
