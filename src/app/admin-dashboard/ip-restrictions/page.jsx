"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, Users, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function GlobalIpRestrictionPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [allIps, setAllIps] = useState([]);
    const [newIp, setNewIp] = useState("");
    const [data, setData] = useState({
        ip_restriction_enabled: 0,
    });

    const fetchData = async () => {
        try {
            const res = await fetch("/api/admin/ip-restrictions");
            const json = await res.json();
            if (res.ok) {
                setAllIps(json.allIps || []);
                if (json.globalRestrictionEnabled !== undefined) {
                    setData((d) => ({ ...d, ip_restriction_enabled: json.globalRestrictionEnabled }));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddIp = async (e) => {
        e.preventDefault();
        const ip = newIp.trim();
        if (!ip) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/ip-restrictions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ addIp: ip }),
            });
            const result = await res.json();
            if (res.ok) {
                setNewIp("");
                await fetchData();
                alert("IP added to all users successfully!");
            } else {
                alert(result.error || "Failed to add IP");
            }
        } catch (err) {
            alert("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteIp = async (ip) => {
        if (!confirm(`Remove IP ${ip} from all users?`)) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/ip-restrictions?ip=${encodeURIComponent(ip)}`, { method: "DELETE" });
            const result = await res.json();
            if (res.ok) {
                await fetchData();
                alert("IP removed from all users.");
            } else {
                alert(result.error || "Failed to remove IP");
            }
        } catch (err) {
            alert("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (e) => {
        const enabled = e.target.checked ? 1 : 0;
        if (!confirm(enabled ? "Enable IP restriction for ALL users?" : "Disable IP restriction for ALL users?")) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/ip-restrictions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bulk: true, bulkToggleOnly: true, ip_restriction_enabled: enabled }),
            });
            if (res.ok) {
                setData({ ...data, ip_restriction_enabled: enabled });
                alert("Settings updated.");
            }
        } catch (err) {
            alert("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-10 border-2 border-red-50">
            <div className="flex items-center justify-between mb-8 border-b pb-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                        <ShieldAlert className="text-red-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Global IP Settings</h1>
                        <p className="text-gray-500 text-sm">Apply IP restrictions to <span className="font-semibold text-red-600 uppercase">ALL</span> users</p>
                    </div>
                </div>
                <Link href="/admin-dashboard/employees" className="text-gray-500 hover:text-gray-800">
                    <ArrowLeft size={24} />
                </Link>
            </div>

            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3">
                <Users className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> These changes will affect every employee and representative in the system. Use this for office-wide IP restrictions.
                </p>
            </div>

            <div className="space-y-6">
                {/* Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                        <h3 className="font-semibold text-gray-700">Enable Restriction for Everyone</h3>
                        <p className="text-xs text-gray-500">Enable or disable IP check for all users at once.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={data.ip_restriction_enabled === 1}
                            onChange={handleToggle}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                </div>

                {/* All IPs List */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">All IPs (across users)</label>
                    {loading ? (
                        <p className="text-gray-500 text-sm">Loading...</p>
                    ) : allIps.length === 0 ? (
                        <p className="text-gray-500 text-sm">No IPs added yet.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {allIps.map((ip) => (
                                <div
                                    key={ip}
                                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200"
                                >
                                    <span className="font-mono text-sm">{ip}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteIp(ip)}
                                        disabled={saving}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                        title="Remove from all users"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-gray-400 italic">Delete removes this IP from all users. Add new IPs below.</p>
                </div>

                {/* Add New IP */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Add New IP</label>
                    <form onSubmit={handleAddIp} className="flex gap-2">
                        <input
                            type="text"
                            value={newIp}
                            onChange={(e) => setNewIp(e.target.value)}
                            placeholder="e.g. 192.168.1.1"
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                        />
                        <button
                            type="submit"
                            disabled={saving || !newIp.trim()}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 disabled:bg-red-400"
                        >
                            <Plus size={18} />
                            Add
                        </button>
                    </form>
                    <p className="text-xs text-gray-400 italic">New IP will be added to all users (existing IPs remain).</p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end pt-4 border-t">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
