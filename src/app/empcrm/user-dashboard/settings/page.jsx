"use client";

import { useState, useEffect } from "react";
import { Save, Mail, Lock, Server, Eye, EyeOff } from "lucide-react";

export default function EmailSettingsPage() {
    const [formData, setFormData] = useState({
        smtp_host: "mail.dynacleanindustries.com",
        smtp_port: 587,
        smtp_user: "",
        smtp_pass: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/empcrm/settings/email-credentials");
            const data = await response.json();

            if (data.success && data.configured) {
                setConfigured(true);
                setFormData(prev => ({
                    ...prev,
                    smtp_host: data.credentials.smtp_host,
                    smtp_port: data.credentials.smtp_port,
                    smtp_user: data.credentials.smtp_user,
                    smtp_pass: data.credentials.smtp_pass,
                }));
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const response = await fetch("/api/empcrm/settings/email-credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (data.success) {
                alert("Settings saved successfully");
                setConfigured(true);
                setFormData(prev => ({ ...prev })); // Clear password from state after save
            } else {
                alert(data.error || "Failed to save settings");
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Error saving settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Mail className="w-8 h-8 text-blue-600" />
                    Email Configuration
                </h1>
                <p className="text-gray-600 mt-2">
                    Configure your email settings to send leave applications and other notifications.
                </p>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${configured ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    <div className={`w-3 h-3 rounded-full ${configured ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className="font-medium">
                        Status: {configured ? "Configured" : "Not Configured"}
                    </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                SMTP Username <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.smtp_user}
                                onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                                placeholder="Username (e.g. jdoe)"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                SMTP Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={formData.smtp_pass}
                                    onChange={(e) => setFormData({ ...formData, smtp_pass: e.target.value })}
                                    placeholder={configured ? "Enter new password to update" : "App Password (required)"}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                                    required={!configured} // Only required if not already configured
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Server className="w-4 h-4" />
                                SMTP Host
                            </label>
                            <input
                                type="text"
                                value={formData.smtp_host}
                                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Server className="w-4 h-4" />
                                SMTP Port
                            </label>
                            <input
                                type="number"
                                value={formData.smtp_port}
                                onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? "Saving..." : "Save Settings"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
