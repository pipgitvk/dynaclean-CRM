"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, Save, Users } from "lucide-react";
import Link from "next/link";

export default function GlobalIpRestrictionPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({
        allowed_ips: "",
        ip_restriction_enabled: 0,
    });

    const handleSave = async (e) => {
        e.preventDefault();
        const confirmed = confirm("Are you sure you want to apply these settings to EVERY user? This will overwrite individual user settings.");
        if (!confirmed) return;

        setSaving(true);
        try {
            const res = await fetch("/api/admin/ip-restrictions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bulk: true,
                    allowed_ips: data.allowed_ips,
                    ip_restriction_enabled: data.ip_restriction_enabled,
                }),
            });
            const result = await res.json();
            if (res.ok) {
                alert("Global settings applied successfully!");
                router.push("/admin-dashboard/employees");
            } else {
                alert(result.error || "Failed to save settings");
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

            <form onSubmit={handleSave} className="space-y-6">
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
                            onChange={(e) => setData({ ...data, ip_restriction_enabled: e.target.checked ? 1 : 0 })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                </div>

                {/* IPs Textarea */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Global Allowed IP Addresses</label>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all h-32"
                        placeholder="Enter IPs separated by commas (e.g., 192.168.1.1, 103.44.12.5)"
                        value={data.allowed_ips}
                        onChange={(e) => setData({ ...data, allowed_ips: e.target.value })}
                        disabled={data.ip_restriction_enabled === 0}
                    />
                    <p className="text-xs text-gray-400 italic">This list will be applied to all users. Useful for when entire team works from the same static IP(s).</p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-4 border-t">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center space-x-2 disabled:bg-red-400 shadow-md"
                    >
                        <ShieldAlert size={18} />
                        <span>{saving ? "Applying..." : "Apply to Everyone"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
