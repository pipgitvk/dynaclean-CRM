"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Save, Loader } from "lucide-react";

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState({
    company_name: "",
    company_address_line1: "",
    company_address_line2: "",
    company_email: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/company-settings");
        if (res.ok) {
          const data = await res.json();
          setSettings((prev) => ({
            ...prev,
            company_name: data.company_name || prev.company_name,
            company_address_line1: data.company_address_line1 || prev.company_address_line1,
            company_address_line2: data.company_address_line2 || prev.company_address_line2,
            company_email: data.company_email || prev.company_email,
          }));
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fieldsToSave = [
        { key: "company_name", value: settings.company_name },
        { key: "company_address_line1", value: settings.company_address_line1 },
        { key: "company_address_line2", value: settings.company_address_line2 },
        { key: "company_email", value: settings.company_email },
      ];

      for (const field of fieldsToSave) {
        const res = await fetch("/api/company-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setting_key: field.key,
            setting_value: field.value,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to save ${field.key}`);
        }
      }

      toast.success("Company settings updated successfully");
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size={40} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Company Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage company information displayed in PDFs and reports
        </p>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
        {/* Company Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name
          </label>
          <input
            type="text"
            value={settings.company_name}
            onChange={(e) => handleChange("company_name", e.target.value)}
            placeholder="e.g., Dynaclean Industries Pvt. Ltd."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Address Line 1 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address Line 1
          </label>
          <input
            type="text"
            value={settings.company_address_line1}
            onChange={(e) => handleChange("company_address_line1", e.target.value)}
            placeholder="e.g., 1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Address Line 2 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address Line 2 / City
          </label>
          <input
            type="text"
            value={settings.company_address_line2}
            onChange={(e) => handleChange("company_address_line2", e.target.value)}
            placeholder="e.g., Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu - 641006"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Email
          </label>
          <input
            type="email"
            value={settings.company_email}
            onChange={(e) => handleChange("company_email", e.target.value)}
            placeholder="e.g., sales@dynacleanindustries.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Preview */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mt-6">
          <p className="text-sm font-medium text-gray-600 mb-3">Preview</p>
          <div className="text-center text-xs space-y-1">
            <p className="font-bold text-gray-800">{settings.company_name}</p>
            <p className="text-gray-600">{settings.company_address_line1}</p>
            <p className="text-gray-600">{settings.company_address_line2}</p>
            <p className="text-gray-600">E-Mail: {settings.company_email}</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <Loader size={16} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
