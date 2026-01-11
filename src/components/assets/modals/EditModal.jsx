"use client";

import { useState, useEffect } from "react";

export default function EditModal({ asset, onClose }) {
  const [formData, setFormData] = useState({
    asset_name: asset.asset_name || "",
    brand_name: asset.brand_name || "",
    model_name: asset.model_name || "",
    serial_number: asset.serial_number || "",
    color: asset.color || "",
    note: asset.note || "",
    associated_email: asset.associated_email || "",
    email_password: asset.email_password || "",
    device_password: asset.device_password || "",
    phone_number: asset.phone_number || "",
    // Mobile
    sim_no_1: asset.sim_no_1 || "",
    sim_no_2: asset.sim_no_2 || "",
    provider_1: asset.provider_1 || "",
    provider_2: asset.provider_2 || "",
    imei_no_1: asset.imei_no_1 || "",
    imei_no_2: asset.imei_no_2 || "",
    login_gmails: asset.login_gmails || "",
    login_gmail_password: asset.login_gmail_password || "",
    device_lock_password: asset.device_lock_password || "",
    whatsapp_no_normal: asset.whatsapp_no_normal || "",
    whatsapp_no_business: asset.whatsapp_no_business || "",
    backup_gmail_normal: asset.backup_gmail_normal || "",
    backup_gmail_business: asset.backup_gmail_business || "",
    google_contact_gmail: asset.google_contact_gmail || "",
    // SIM
    sim_plan: asset.sim_plan || "",
    sim_billing_cycle: asset.sim_billing_cycle || "",
    sim_billing_type: asset.sim_billing_type || "",
    // Accessories
    accessory_type: asset.accessory_type || "",
    capacity: asset.capacity || "",
    // Router/Dongle
    imei_or_serial: asset.imei_or_serial || "",
    network_provider: asset.network_provider || "",
    network_speed_plan: asset.network_speed_plan || "",
    login_credentials: asset.login_credentials || "",
    // Technical specs JSON string editable as text for now
    technical_specs: asset.technical_specs || "",
  });
  const [loginRows, setLoginRows] = useState(() => {
    const emails = (asset.login_gmails || '').split(',').map((s) => s.trim());
    const passwords = (asset.login_gmail_password || '').split(',');
    const rows = [];
    for (let i = 0; i < Math.max(emails.length, passwords.length); i++) {
      if (emails[i] || passwords[i]) rows.push({ email: emails[i] || '', password: passwords[i] || '' });
    }
    return rows.length ? rows : [{ email: '', password: '' }];
  });
  // Router/Dongle credentials (derive from JSON if present)
  const [routerCreds, setRouterCreds] = useState(() => {
    try {
      const obj = typeof asset.login_credentials === 'string' && asset.login_credentials.trim().startsWith('{')
        ? JSON.parse(asset.login_credentials)
        : (typeof asset.login_credentials === 'object' ? asset.login_credentials : {});
      return { username: obj?.username || '', password: obj?.password || '' };
    } catch {
      return { username: '', password: '' };
    }
  });
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      asset_name: asset.asset_name || "",
      brand_name: asset.brand_name || "",
      model_name: asset.model_name || "",
      serial_number: asset.serial_number || "",
      color: asset.color || "",
      note: asset.note || "",
      associated_email: asset.associated_email || "",
      email_password: asset.email_password || "",
      device_password: asset.device_password || "",
      phone_number: asset.phone_number || "",
      sim_no_1: asset.sim_no_1 || "",
      sim_no_2: asset.sim_no_2 || "",
      provider_1: asset.provider_1 || "",
      provider_2: asset.provider_2 || "",
      imei_no_1: asset.imei_no_1 || "",
      imei_no_2: asset.imei_no_2 || "",
      login_gmails: asset.login_gmails || "",
      login_gmail_password: asset.login_gmail_password || "",
      device_lock_password: asset.device_lock_password || "",
      whatsapp_no_normal: asset.whatsapp_no_normal || "",
      whatsapp_no_business: asset.whatsapp_no_business || "",
      backup_gmail_normal: asset.backup_gmail_normal || "",
      backup_gmail_business: asset.backup_gmail_business || "",
      google_contact_gmail: asset.google_contact_gmail || "",
      sim_plan: asset.sim_plan || "",
      sim_billing_cycle: asset.sim_billing_cycle || "",
      sim_billing_type: asset.sim_billing_type || "",
      accessory_type: asset.accessory_type || "",
      capacity: asset.capacity || "",
      imei_or_serial: asset.imei_or_serial || "",
      network_provider: asset.network_provider || "",
      network_speed_plan: asset.network_speed_plan || "",
      login_credentials: asset.login_credentials || "",
      technical_specs: asset.technical_specs || "",
    }));
  }, [asset]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, action: "edit" };
      // Compose gmail CSVs for Mobile
      if (asset.asset_category === 'Mobile') {
        const filtered = loginRows.filter((r) => (r.email && r.email.trim()) || (r.password && r.password.trim()));
        payload.login_gmails = filtered.map((r) => (r.email || '').trim()).filter(Boolean).join(',');
        payload.login_gmail_password = filtered.map((r) => r.password || '').join(',');
      }

      // Router/Dongle: compose login_credentials JSON string
      if (['Router','Dongle'].includes(asset.asset_category)) {
        payload.login_credentials = JSON.stringify({ username: routerCreds.username || '', password: routerCreds.password || '' });
      }

      const response = await fetch(`/api/assets/${asset.asset_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update asset.");
      onClose();
      alert("Asset updated successfully!");
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
    }
  };

  return (
    <div>
      <h3 className="text-xl font-bold mb-4 text-gray-800">Edit Asset</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Asset Name</label>
            <input type="text" name="asset_name" value={formData.asset_name} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Brand</label>
            <input type="text" name="brand_name" value={formData.brand_name} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Model</label>
            <input type="text" name="model_name" value={formData.model_name} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Serial Number</label>
            <input type="text" name="serial_number" value={formData.serial_number} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <input type="text" name="color" value={formData.color} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea name="note" value={formData.note} onChange={handleChange} rows={2} className="mt-1 p-2 w-full border rounded-md" />
          </div>
        </div>

        {/* Common credentials (only for device computers) */}
        {['Laptop','Desktop','Monitor','CPU'].includes(asset.asset_category) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Associated Email</label>
              <input type="email" name="associated_email" value={formData.associated_email} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700">Email Password</label>
              <input type={showPasswords ? "text" : "password"} name="email_password" value={formData.email_password} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
              <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute top-7 right-2 text-sm text-blue-600 hover:underline">{showPasswords ? "Hide" : "Show"}</button>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700">Device Password</label>
              <input type={showPasswords ? "text" : "password"} name="device_password" value={formData.device_password} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
              <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute top-7 right-2 text-sm text-blue-600 hover:underline">{showPasswords ? "Hide" : "Show"}</button>
            </div>
          </>
        )}

        {/* Category-specific quick edits */}
        {asset.asset_category === 'Mobile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">SIM 1</label>
              <input type="text" name="sim_no_1" value={formData.sim_no_1} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">SIM 2</label>
              <input type="text" name="sim_no_2" value={formData.sim_no_2} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Provider 1</label>
              <input type="text" name="provider_1" value={formData.provider_1} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Provider 2</label>
              <input type="text" name="provider_2" value={formData.provider_2} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IMEI 1</label>
              <input type="text" name="imei_no_1" value={formData.imei_no_1} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">IMEI 2</label>
              <input type="text" name="imei_no_2" value={formData.imei_no_2} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Lock Password</label>
              <input type="text" name="device_lock_password" value={formData.device_lock_password} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input type="text" name="phone_number" value={formData.phone_number} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Normal WhatsApp</label>
              <input type="text" name="whatsapp_no_normal" value={formData.whatsapp_no_normal} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Business WhatsApp</label>
              <input type="text" name="whatsapp_no_business" value={formData.whatsapp_no_business} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Backup Gmail (Normal)</label>
              <input type="email" name="backup_gmail_normal" value={formData.backup_gmail_normal} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Backup Gmail (Business)</label>
              <input type="email" name="backup_gmail_business" value={formData.backup_gmail_business} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Google Contact Gmail</label>
              <input type="email" name="google_contact_gmail" value={formData.google_contact_gmail} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Login Gmail Accounts</label>
              <div className="overflow-x-auto border rounded-md">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Gmail</th>
                      <th className="text-left p-2">Password</th>
                      <th className="p-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginRows.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">
                          <input type="email" value={row.email} onChange={(e) => setLoginRows((prev) => prev.map((r,i)=> i===idx?{...r,email:e.target.value}:r))} className="w-full p-2 border rounded" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={row.password} onChange={(e) => setLoginRows((prev) => prev.map((r,i)=> i===idx?{...r,password:e.target.value}:r))} className="w-full p-2 border rounded" />
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => setLoginRows((prev)=>prev.filter((_,i)=>i!==idx))} className="px-2 py-1 text-red-600">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2">
                <button type="button" onClick={() => setLoginRows((prev)=>[...prev,{email:'',password:''}])} className="px-3 py-1 bg-gray-100 border rounded">Add Row</button>
              </div>
            </div>
          </div>
        )}

        {asset.asset_category === 'SIM' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">SIM Number (ICCID)</label>
              <input type="text" name="sim_no_1" value={formData.sim_no_1} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Provider</label>
              <input type="text" name="provider_1" value={formData.provider_1} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Plan / Package</label>
              <input type="text" name="sim_plan" value={formData.sim_plan} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Billing Cycle</label>
              <select name="sim_billing_cycle" value={formData.sim_billing_cycle} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md">
                <option value="">Select</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select name="sim_billing_type" value={formData.sim_billing_type} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md">
                <option value="">Select</option>
                <option value="Postpaid">Postpaid</option>
                <option value="Prepaid">Prepaid</option>
              </select>
            </div>
          </div>
        )}

        {['Keyboard','Mouse','Pendrive','Headphones','Charger','ExternalHardDisk','UPS'].includes(asset.asset_category) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select name="accessory_type" value={formData.accessory_type} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md">
                <option value="">Select</option>
                <option value="Wired">Wired</option>
                <option value="Wireless">Wireless</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Capacity</label>
              <input type="text" name="capacity" value={formData.capacity} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
          </div>
        )}

        {['Router','Dongle'].includes(asset.asset_category) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">IMEI / Serial</label>
              <input type="text" name="imei_or_serial" value={formData.imei_or_serial} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Network Provider</label>
              <input type="text" name="network_provider" value={formData.network_provider} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Speed / Plan</label>
              <input type="text" name="network_speed_plan" value={formData.network_speed_plan} onChange={handleChange} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Login Username</label>
              <input type="text" value={routerCreds.username} onChange={(e)=> setRouterCreds((p)=>({...p, username: e.target.value}))} className="mt-1 p-2 w-full border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Login Password</label>
              <input type="text" value={routerCreds.password} onChange={(e)=> setRouterCreds((p)=>({...p, password: e.target.value}))} className="mt-1 p-2 w-full border rounded-md" />
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
