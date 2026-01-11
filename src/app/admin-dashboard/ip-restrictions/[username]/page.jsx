"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shield, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function UserIpRestrictionPage() {
    const { username } = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({
        allowed_ips: "",
        ip_restriction_enabled: 0,
    });

    useEffect(() => {
        fetch(`/api/admin/ip-restrictions?username=${username}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.error) {
                    alert(json.error);
                } else {
                    setData({
                        allowed_ips: json.allowed_ips || "",
                        ip_restriction_enabled: json.ip_restriction_enabled || 0,
                    });
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, [username]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/admin/ip-restrictions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    allowed_ips: data.allowed_ips,
                    ip_restriction_enabled: data.ip_restriction_enabled,
                }),
            });
            const result = await res.json();
            if (res.ok) {
                alert("Settings saved successfully!");
                router.back();
            } else {
                alert(result.error || "Failed to save settings");
            }
        } catch (err) {
            alert("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-10">
            <div className="flex items-center justify-between mb-8 border-b pb-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Shield className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">IP Restriction Settings</h1>
                        <p className="text-gray-500 text-sm">Managing security for user: <span className="font-semibold">{username}</span></p>
                    </div>
                </div>
                <Link href="/admin-dashboard/employees" className="text-gray-500 hover:text-gray-800">
                    <ArrowLeft size={24} />
                </Link>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                        <h3 className="font-semibold text-gray-700">Enable IP Restriction</h3>
                        <p className="text-xs text-gray-500">Only permit logins from the specified IP addresses.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={data.ip_restriction_enabled === 1}
                            onChange={(e) => setData({ ...data, ip_restriction_enabled: e.target.checked ? 1 : 0 })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* IPs Textarea */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Allowed IP Addresses</label>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-32"
                        placeholder="Enter IPs separated by commas (e.g., 192.168.1.1, 103.44.12.5)"
                        value={data.allowed_ips}
                        onChange={(e) => setData({ ...data, allowed_ips: e.target.value })}
                        disabled={data.ip_restriction_enabled === 0}
                    />
                    <p className="text-xs text-gray-400 italic">Separate multiple IPs with commas. Leave blank to allow from any IP even if enabled (not recommended).</p>
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
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center space-x-2 disabled:bg-blue-400"
                    >
                        <Save size={18} />
                        <span>{saving ? "Saving..." : "Save Changes"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
