"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

export default function AssetFormPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loginRows, setLoginRows] = useState([{ email: "", password: "" }]);
  const [formData, setFormData] = useState({
    // Add assetType here
    assetType: "Device",
    assetCategory: "",
    // Basic Asset Info
    assetName: "",
    brandName: "",
    modelName: "",
    serialNumber: "",
    assetTagNumber: "",
    assetCondition: "New",
    color: "",
    // Credentials Info (Sensitive)
    associatedEmail: "",
    emailPassword: "",
    devicePassword: "",
    phoneNumber: "",
    // Purchase & Warranty Info
    purchaseDate: "",
    purchasedFrom: "",
    purchasePrice: "",
    invoiceNumber: "",
    warrantyPeriod: "",
    // Attachments
    invoiceAttachment: null,
    warrantyCard: null,
    userManual: null,
    assetPhotos: [],
    note: "",
  });

  const [errors, setErrors] = useState({});
  const isSim = formData.assetType === "Accessory" && formData.assetCategory === "SIM";
  const totalSteps = isSim ? 1 : 3;

  const handleChange = (e) => {
    const { name, value, type, files, checked } = e.target;
    if (type === "file") {
      if (name === "assetPhotos") {
        const filesArr = files ? Array.from(files) : [];
        setFormData((prev) => ({ ...prev, assetPhotos: filesArr }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: files && files[0] ? files[0] : null }));
      }
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      // If switching between Asset and Accessory, clear category and category-specific fields
      if (name === "assetType") {
        setFormData((prev) => ({
          ...prev,
          assetType: value,
          assetCategory: "",
          // Clear some category-specific fields on type change
          sim_no_1: "",
          sim_no_2: "",
          provider_1: "",
          provider_2: "",
          imei_no_1: "",
          imei_no_2: "",
          login_gmails: "",
          login_gmail_password: "",
          device_lock_password: "",
          whatsapp_no_normal: "",
          whatsapp_no_business: "",
          backup_gmail_normal: "",
          backup_gmail_business: "",
          google_contact_gmail: "",
          checklist_daily_backup: false,
          checklist_auto_call_recording: false,
          checklist_google_contact_backup_on: false,
          processor: "",
          ramSize: "",
          ramType: "",
          storageType: "",
          storageSize: "",
          osName: "",
          osVersion: "",
          macAddress: "",
          installedSoftware: "",
          sim_plan: "",
          sim_billing_cycle: "",
          sim_billing_type: "",
          accessory_type: "",
          capacity: "",
          imei_or_serial: "",
          network_provider: "",
          network_speed_plan: "",
          login_username: "",
          login_password: "",
        }));
        setCurrentStep(1);
      } else if (name === "assetCategory") {
        // Reset all category-specific fields when category changes
        setFormData((prev) => ({
          ...prev,
          assetCategory: value,
          // If asset name is empty, prefill it with selected category for logical defaults
          assetName: prev.assetName && prev.assetName.trim() ? prev.assetName : value,
          // For SIM accessory, also default brand to SIM if empty
          brandName: value === "SIM" && (!prev.brandName || !prev.brandName.trim()) ? "SIM" : prev.brandName,
          sim_no_1: "",
          sim_no_2: "",
          provider_1: "",
          provider_2: "",
          imei_no_1: "",
          imei_no_2: "",
          login_gmails: "",
          login_gmail_password: "",
          // reset login rows table
          // first row blank
          // note: UI reads from loginRows state, not these string fields
          
          device_lock_password: "",
          whatsapp_no_normal: "",
          whatsapp_no_business: "",
          backup_gmail_normal: "",
          backup_gmail_business: "",
          google_contact_gmail: "",
          checklist_daily_backup: false,
          checklist_auto_call_recording: false,
          checklist_google_contact_backup_on: false,
          processor: "",
          ramSize: "",
          ramType: "",
          storageType: "",
          storageSize: "",
          osName: "",
          osVersion: "",
          macAddress: "",
          installedSoftware: "",
          sim_plan: "",
          sim_billing_cycle: "",
          sim_billing_type: "",
          accessory_type: "",
          capacity: "",
          imei_or_serial: "",
          network_provider: "",
          network_speed_plan: "",
          login_username: "",
          login_password: "",
        }));
        setCurrentStep(1);
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
      }
    }
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // Gmail rows handlers (Mobile only UI)
  const addLoginRow = () => {
    setLoginRows((prev) => [...prev, { email: "", password: "" }]);
  };
  const updateLoginRow = (index, field, value) => {
    setLoginRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const removeLoginRow = (index) => {
    setLoginRows((prev) => prev.filter((_, i) => i !== index));
  };

  const validateStep = () => {
    const stepErrors = {};

    switch (currentStep) {
      case 1:
        if (!formData.assetName)
          stepErrors.assetName = "Asset Name is required.";
        if (!formData.brandName)
          stepErrors.brandName = "Brand Name is required.";
        if (!isSim && !formData.assetCondition)
          stepErrors.assetCondition = "Asset Condition is required.";
        // Mobile/SIM specific number validations on step 1 (when visible)
        if (formData.assetCategory === "Mobile") {
          if (formData.phoneNumber) {
            const phoneOk = /^\+?[0-9]{10,15}$/.test(formData.phoneNumber.trim());
            if (!phoneOk) stepErrors.phoneNumber = "Enter valid phone (10-15 digits, optional +).";
          }
          if (formData.sim_no_1) {
            const simOk = /^[0-9]{10,15}$/.test(formData.sim_no_1.trim());
            if (!simOk) stepErrors.sim_no_1 = "SIM 1 must be 10-15 digits.";
          }
          if (formData.sim_no_2) {
            const simOk = /^[0-9]{10,15}$/.test(formData.sim_no_2.trim());
            if (!simOk) stepErrors.sim_no_2 = "SIM 2 must be 10-15 digits.";
          }
        }
        if (formData.assetCategory === "SIM") {
          // For SIM accessory, allow phone/SIM number (10-15 digits)
          if (formData.sim_no_1) {
            const simOk = /^[0-9]{10,15}$/.test(formData.sim_no_1.trim());
            if (!simOk) stepErrors.sim_no_1 = "SIM Number must be 10-15 digits.";
          }
        }
        break;
      case 2:
        if (!formData.purchaseDate)
          stepErrors.purchaseDate = "Purchase Date is required.";
        if (!formData.purchasedFrom)
          stepErrors.purchasedFrom = "Purchased From is required.";
        if (!formData.purchasePrice)
          stepErrors.purchasePrice = "Purchase Price is required.";
        if (!formData.invoiceNumber)
          stepErrors.invoiceNumber = "Invoice Number is required.";
        if (!formData.warrantyPeriod)
          stepErrors.warrantyPeriod = "Warranty Period is required.";
        break;
      case 3:
        // Adjusting validation for accessories
        // Only require device credentials for non-Mobile Device categories
        const needsDeviceCreds = formData.assetType === "Device" && formData.assetCategory !== "Mobile";
        if (!formData.associatedEmail && needsDeviceCreds)
          stepErrors.associatedEmail = "Associated Email is required.";
        if (!formData.emailPassword && needsDeviceCreds)
          stepErrors.emailPassword = "Email Password is required.";
        if (!formData.devicePassword && needsDeviceCreds)
          stepErrors.devicePassword = "Device Password is required.";
        break;
      default:
        break;
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep((prev) => (prev < totalSteps ? prev + 1 : prev));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Only allow submit on the final step
    if (currentStep !== totalSteps) {
      return;
    }
    if (!validateStep()) {
      return;
    }

    const submissionData = new FormData();
    // Whitelists
    const commonKeys = [
      "assetType","assetCategory","assetName","brandName","modelName","serialNumber","assetTagNumber","assetCondition","color",
      "purchaseDate","purchasedFrom","purchasePrice","invoiceNumber","warrantyPeriod","note",
    ];
    const deviceCredentialKeys = ["associatedEmail","emailPassword","devicePassword","phoneNumber"];
    const mobileKeys = [
      "sim_no_1","sim_no_2","provider_1","provider_2","imei_no_1","imei_no_2","login_gmails","login_gmail_password","device_lock_password",
      "whatsapp_no_normal","whatsapp_no_business","backup_gmail_normal","backup_gmail_business","google_contact_gmail",
      // checklist is JSON generated below
    ];
    const techKeys = ["processor","ramSize","ramType","storageType","storageSize","osName","osVersion","macAddress","installedSoftware"]; // JSON generated below
    const simKeys = ["sim_no_1","provider_1","sim_plan","sim_billing_cycle","sim_billing_type"];
    const accessoryKeys = ["accessory_type","capacity"];
    const routerKeys = ["imei_or_serial","network_provider","network_speed_plan","login_username","login_password"]; // JSON for creds below

    const allowed = new Set(commonKeys);
    const isDevice = formData.assetType === "Device";
    if (isDevice) {
      deviceCredentialKeys.forEach((k) => allowed.add(k));
      if (formData.assetCategory === "Mobile") mobileKeys.forEach((k) => allowed.add(k));
      if (["Laptop","Desktop","Monitor","CPU"].includes(formData.assetCategory)) techKeys.forEach((k) => allowed.add(k));
    } else {
      // Accessory types
      if (formData.assetCategory === "SIM") simKeys.forEach((k) => allowed.add(k));
      if (["Keyboard","Mouse","Pendrive","Headphones","Charger","ExternalHardDisk","UPS"].includes(formData.assetCategory)) accessoryKeys.forEach((k) => allowed.add(k));
      if (["Router","Dongle"].includes(formData.assetCategory)) routerKeys.forEach((k) => allowed.add(k));
    }

    // Append scalar fields from whitelist
    Object.entries(formData).forEach(([key, val]) => {
      if (!allowed.has(key)) return;
      if (key === "assetPhotos") return;
      // we'll append login_gmails and login_gmail_password after composing from table
      if (key === "login_gmails" || key === "login_gmail_password") return;
      if (val !== null && val !== undefined && val !== "") {
        submissionData.append(key, val);
      }
    });
    // Files
    if (Array.isArray(formData.assetPhotos)) {
      formData.assetPhotos.forEach((file) => { if (file) submissionData.append("assetPhotos", file); });
    }

    // Checklist JSON for Mobile
    if (formData.assetCategory === "Mobile") {
      const checklist = {
        daily_backup: !!formData.checklist_daily_backup,
        auto_call_recording: !!formData.checklist_auto_call_recording,
        google_contact_backup_on: !!formData.checklist_google_contact_backup_on,
      };
      submissionData.append("checklist", JSON.stringify(checklist));

      // Compose comma-separated gmail emails and passwords from table rows
      const filtered = loginRows.filter((r) => (r.email && r.email.trim()) || (r.password && r.password.trim()));
      const emailsCsv = filtered.map((r) => (r.email || "").trim()).filter(Boolean).join(",");
      const passwordsCsv = filtered.map((r) => r.password || "").join(",");
      if (emailsCsv) submissionData.append("login_gmails", emailsCsv);
      if (passwordsCsv) submissionData.append("login_gmail_password", passwordsCsv);
    }
    // Technical specs JSON for device computers
    if (["Laptop","Desktop","Monitor","CPU"].includes(formData.assetCategory)) {
      const technical_specs = {
        processor: formData.processor || undefined,
        ram: { size_gb: formData.ramSize || undefined, type: formData.ramType || undefined },
        storage: formData.storageType || formData.storageSize ? [{ type: formData.storageType || undefined, size_gb: formData.storageSize || undefined }] : [],
        os: { name: formData.osName || undefined, version: formData.osVersion || undefined },
        mac_address: formData.macAddress || undefined,
        installed_software: formData.installedSoftware ? formData.installedSoftware.split(",").map((s)=>s.trim()).filter(Boolean) : [],
      };
      submissionData.append("technical_specs", JSON.stringify(technical_specs));
    }
    // Login credentials JSON for Router/Dongle
    if (["Router","Dongle"].includes(formData.assetCategory)) {
      const login_credentials = { username: formData.login_username || "", password: formData.login_password || "" };
      submissionData.append("login_credentials", JSON.stringify(login_credentials));
    }

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        body: submissionData,
      });

      if (!response.ok) {
        throw new Error("Failed to save asset.");
      }

      const result = await response.json();
      console.log("Success:", result);
      toast.success("Asset has been successfully created!");
      window.location.reload();
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred. Please try again.");
    }
  };

  // Prevent Enter key from submitting the form before final step
  const handleKeyDown = (e) => {
    // Always prevent Enter from submitting; submission must be via the button
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Basic Asset Info
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Product Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="assetType"
                  value={formData.assetType}
                  onChange={handleChange}
                  className="mt-1 p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Device">Asset</option>
                  <option value="Accessory">Accessory</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">Asset Category</label>
                <select
                  name="assetCategory"
                  value={formData.assetCategory}
                  onChange={handleChange}
                  className="mt-1 p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select category</option>
                  {formData.assetType === 'Device' ? (
                    <>
                      <optgroup label="Assets">
                        <option value="Mobile">Mobile</option>
                        <option value="Laptop">Laptop</option>
                        <option value="Desktop">Desktop</option>
                        <option value="Monitor">Monitor</option>
                        <option value="CPU">CPU</option>
                        <option value="Printer">Printer</option>
                        <option value="Tablet">Tablet</option>
                      </optgroup>
                    </>
                  ) : (
                    <>
                      <optgroup label="Accessories">
                        <option value="SIM">SIM</option>
                        <option value="Keyboard">Keyboard</option>
                        <option value="Mouse">Mouse</option>
                        <option value="Pendrive">Pendrive</option>
                        <option value="Headphones">Headphones / Earphones</option>
                        <option value="Charger">Charger / Adapter</option>
                        <option value="ExternalHardDisk">External Hard Disk</option>
                        <option value="UPS">UPS</option>
                        <option value="Router">Router</option>
                        <option value="Dongle">Dongle</option>
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Asset Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="assetName"
                  value={formData.assetName}
                  onChange={handleChange}
                  placeholder="e.g. Laptop, Phone, Monitor"
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                    errors.assetName
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {errors.assetName && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.assetName}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="brandName"
                  value={formData.brandName}
                  onChange={handleChange}
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                    errors.brandName
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {errors.brandName && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.brandName}
                  </p>
                )}
              </div>

              {/* Conditional fields for Devices only */}
              {formData.assetType === "Device" && (
                <>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700">
                      Model Name / Number
                    </label>
                    <input
                      type="text"
                      name="modelName"
                      value={formData.modelName}
                      onChange={handleChange}
                      className="mt-1 p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      name="serialNumber"
                      value={formData.serialNumber}
                      onChange={handleChange}
                      className="mt-1 p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700">
                      Asset Tag Number
                    </label>
                    <input
                      type="text"
                      name="assetTagNumber"
                      value={formData.assetTagNumber}
                      onChange={handleChange}
                      placeholder="Unique internal code"
                      className="mt-1 p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Asset Condition <span className="text-red-500">*</span>
                </label>
                {!isSim && (
                <select
                  name="assetCondition"
                  value={formData.assetCondition}
                  onChange={handleChange}
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                    errors.assetCondition
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                >
                  <option value="New">New</option>
                  <option value="Used">Used</option>
                  <option value="Refurbished">Refurbished</option>
                  <option value="Damaged">Damaged</option>
                </select>
                )}
                {errors.assetCondition && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.assetCondition}
                  </p>
                )}
              </div>
              {/* When SIM accessory is selected, show SIM details on step 1 itself */}
              {isSim && (
                <>
                  <div className="md:col-span-2" />
                  <div className="md:col-span-2">
                    <h3 className="text-xl font-bold mt-4 mb-2 text-gray-800">SIM Details</h3>
                  </div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">SIM Number</label><input type="text" name="sim_no_1" value={formData.sim_no_1 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" />{errors.sim_no_1 && (<p className="text-red-500 text-xs mt-1">{errors.sim_no_1}</p>)}</div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Provider</label><input type="text" name="provider_1" value={formData.provider_1 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Plan / Package</label><input type="text" name="sim_plan" value={formData.sim_plan || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Billing Cycle</label><select name="sim_billing_cycle" value={formData.sim_billing_cycle || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md"><option value="">Select</option><option value="Monthly">Monthly</option><option value="Yearly">Yearly</option></select></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Postpaid / Prepaid</label><select name="sim_billing_type" value={formData.sim_billing_type || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md"><option value="">Select</option><option value="Postpaid">Postpaid</option><option value="Prepaid">Prepaid</option></select></div>

                  {/* Notes */}
                  <div className="md:col-span-2 mt-4">
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <textarea name="note" value={formData.note} onChange={handleChange} rows={3} className="mt-1 p-3 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </>
              )}
            </div>
          </>
        );
      case 2:
        return (
          <>
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Purchase & Warranty Info
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Purchase Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="purchaseDate"
                  value={formData.purchaseDate}
                  onChange={handleChange}
                  max={new Date().toISOString().split("T")[0]} // Set the max date to today
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                    errors.purchaseDate
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />

                {errors.purchaseDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.purchaseDate}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Purchased From (Vendor){" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="purchasedFrom"
                  value={formData.purchasedFrom}
                  onChange={handleChange}
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                    errors.purchasedFrom
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {errors.purchasedFrom && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.purchasedFrom}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Purchase Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                    errors.purchasePrice
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {errors.purchasePrice && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.purchasePrice}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                    errors.invoiceNumber
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {errors.invoiceNumber && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.invoiceNumber}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Warranty Period <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="warrantyPeriod"
                  value={formData.warrantyPeriod}
                  onChange={handleChange}
                  placeholder="e.g. 1 year, 365 days"
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                    errors.warrantyPeriod
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {errors.warrantyPeriod && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.warrantyPeriod}
                  </p>
                )}
              </div>
            </div>
          </>
        );
      case 3:
        return (
          <>
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              Documents & Credentials
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Purchase Invoice
                </label>
                <input
                  type="file"
                  name="invoiceAttachment"
                  onChange={handleChange}
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${
                    errors.invoiceAttachment
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {errors.invoiceAttachment && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.invoiceAttachment}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Photos of Asset
                </label>
                <input
                  type="file"
                  name="assetPhotos"
                  onChange={handleChange}
                  multiple
                  className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${
                    errors.assetPhotos
                      ? "border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {errors.assetPhotos && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.assetPhotos}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  Warranty Card
                </label>
                <input
                  type="file"
                  name="warrantyCard"
                  onChange={handleChange}
                  className="mt-1 p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700">
                  User Manual
                </label>
                <input
                  type="file"
                  name="userManual"
                  onChange={handleChange}
                  className="mt-1 p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            {/* Conditional Credential fields for Devices only (hide for Mobile to avoid confusion) */}
            {formData.assetType === "Device" && formData.assetCategory !== "Mobile" && (
              <>
                <h3 className="text-xl font-bold mt-8 mb-4 text-gray-800">
                  Credentials
                </h3>
                <p className="text-sm text-red-500 mb-4">
                  Sensitive data. Restrict access to this section!
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700">
                      Associated Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="associatedEmail"
                      value={formData.associatedEmail}
                      onChange={handleChange}
                      className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                        errors.associatedEmail
                          ? "border-red-500"
                          : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      }`}
                    />
                    {errors.associatedEmail && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.associatedEmail}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700">
                      Email Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="emailPassword"
                      value={formData.emailPassword}
                      onChange={handleChange}
                      className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                        errors.emailPassword
                          ? "border-red-500"
                          : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      }`}
                    />
                    {errors.emailPassword && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.emailPassword}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700">
                      Device Password / PIN{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="devicePassword"
                      value={formData.devicePassword}
                      onChange={handleChange}
                      className={`mt-1 p-3 border rounded-md shadow-sm focus:outline-none ${
                        errors.devicePassword
                          ? "border-red-500"
                          : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      }`}
                    />
                    {errors.devicePassword && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.devicePassword}
                      </p>
                    )}
                  </div>
                  {/* Phone number shown in Mobile section instead */}
                </div>
              </>
            )}

            {/* Mobile section */}
            {formData.assetCategory === "Mobile" && (
              <>
                <h3 className="text-xl font-bold mt-8 mb-4 text-gray-800">Mobile Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">SIM 1 No</label><input type="text" name="sim_no_1" value={formData.sim_no_1 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">SIM 2 No</label><input type="text" name="sim_no_2" value={formData.sim_no_2 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">SIM 1 Provider</label><input type="text" name="provider_1" value={formData.provider_1 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">SIM 2 Provider</label><input type="text" name="provider_2" value={formData.provider_2 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">IMEI 1</label><input type="text" name="imei_no_1" value={formData.imei_no_1 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">IMEI 2</label><input type="text" name="imei_no_2" value={formData.imei_no_2 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  {/* Removed single-line login_gmails field; using table below */}
                  {/* Gmail table rows */}
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
                                <input
                                  type="email"
                                  value={row.email}
                                  onChange={(e) => updateLoginRow(idx, 'email', e.target.value)}
                                  placeholder="user@gmail.com"
                                  className="w-full p-2 border rounded"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={row.password}
                                  onChange={(e) => updateLoginRow(idx, 'password', e.target.value)}
                                  placeholder="password"
                                  className="w-full p-2 border rounded"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button type="button" onClick={() => removeLoginRow(idx)} className="px-2 py-1 text-red-600">Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2">
                      <button type="button" onClick={addLoginRow} className="px-3 py-1 bg-gray-100 border rounded">Add Row</button>
                    </div>
                  </div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Phone Number</label><input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Phone Lock Password</label><input type="text" name="device_lock_password" value={formData.device_lock_password || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Normal WhatsApp Number</label><input type="text" name="whatsapp_no_normal" value={formData.whatsapp_no_normal || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Business WhatsApp Number</label><input type="text" name="whatsapp_no_business" value={formData.whatsapp_no_business || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Backup Gmail (Normal)</label><input type="email" name="backup_gmail_normal" value={formData.backup_gmail_normal || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Backup Gmail (Business)</label><input type="email" name="backup_gmail_business" value={formData.backup_gmail_business || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col md:col-span-2"><label className="text-sm font-medium text-gray-700">Google Contact Gmail</label><input type="email" name="google_contact_gmail" value={formData.google_contact_gmail || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex items-center space-x-6 md:col-span-2 mt-2">
                    <label className="flex items-center space-x-2"><input type="checkbox" name="checklist_daily_backup" checked={!!formData.checklist_daily_backup} onChange={handleChange} /><span className="text-sm text-gray-700">Daily Backup</span></label>
                    <label className="flex items-center space-x-2"><input type="checkbox" name="checklist_auto_call_recording" checked={!!formData.checklist_auto_call_recording} onChange={handleChange} /><span className="text-sm text-gray-700">Auto Call Recording</span></label>
                    <label className="flex items-center space-x-2"><input type="checkbox" name="checklist_google_contact_backup_on" checked={!!formData.checklist_google_contact_backup_on} onChange={handleChange} /><span className="text-sm text-gray-700">Google Contact Backup On</span></label>
                  </div>
                </div>
              </>
            )}

            {/* Technical specs */}
            {["Laptop","Desktop","Monitor","CPU"].includes(formData.assetCategory) && (
              <>
                <h3 className="text-xl font-bold mt-8 mb-4 text-gray-800">Technical Specs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Processor</label><input type="text" name="processor" value={formData.processor || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">RAM Size (GB)</label><input type="text" name="ramSize" value={formData.ramSize || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">RAM Type</label><input type="text" name="ramType" value={formData.ramType || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Storage Type</label><input type="text" name="storageType" value={formData.storageType || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Storage Size (GB)</label><input type="text" name="storageSize" value={formData.storageSize || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">OS Name</label><input type="text" name="osName" value={formData.osName || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">OS Version</label><input type="text" name="osVersion" value={formData.osVersion || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">MAC Address</label><input type="text" name="macAddress" value={formData.macAddress || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col md:col-span-2"><label className="text-sm font-medium text-gray-700">Installed Software (comma-separated)</label><input type="text" name="installedSoftware" value={formData.installedSoftware || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                </div>
              </>
            )}

            {/* SIM */}
            {formData.assetCategory === "SIM" && (
              <>
                <h3 className="text-xl font-bold mt-8 mb-4 text-gray-800">SIM Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">SIM Number</label><input type="text" name="sim_no_1" value={formData.sim_no_1 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Provider</label><input type="text" name="provider_1" value={formData.provider_1 || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Plan / Package</label><input type="text" name="sim_plan" value={formData.sim_plan || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Billing Cycle</label><select name="sim_billing_cycle" value={formData.sim_billing_cycle || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md"><option value="">Select</option><option value="Monthly">Monthly</option><option value="Yearly">Yearly</option></select></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Postpaid / Prepaid</label><select name="sim_billing_type" value={formData.sim_billing_type || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md"><option value="">Select</option><option value="Postpaid">Postpaid</option><option value="Prepaid">Prepaid</option></select></div>
                </div>
              </>
            )}

            {/* Accessories */}
            {["Keyboard","Mouse","Pendrive","Headphones","Charger","ExternalHardDisk","UPS"].includes(formData.assetCategory) && (
              <>
                <h3 className="text-xl font-bold mt-8 mb-4 text-gray-800">Accessory Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Type</label><select name="accessory_type" value={formData.accessory_type || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md"><option value="">Select</option><option value="Wired">Wired</option><option value="Wireless">Wireless</option></select></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Capacity</label><input type="text" name="capacity" value={formData.capacity || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                </div>
              </>
            )}

            {/* Router / Dongle */}
            {["Router","Dongle"].includes(formData.assetCategory) && (
              <>
                <h3 className="text-xl font-bold mt-8 mb-4 text-gray-800">Router / Dongle</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">IMEI / Serial</label><input type="text" name="imei_or_serial" value={formData.imei_or_serial || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Network Provider</label><input type="text" name="network_provider" value={formData.network_provider || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Speed / Plan</label><input type="text" name="network_speed_plan" value={formData.network_speed_plan || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Login Username</label><input type="text" name="login_username" value={formData.login_username || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                  <div className="flex flex-col"><label className="text-sm font-medium text-gray-700">Login Password</label><input type="text" name="login_password" value={formData.login_password || ''} onChange={handleChange} className="mt-1 p-3 border border-gray-300 rounded-md" /></div>
                </div>
              </>
            )}

            {/* Note */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea name="note" value={formData.note} onChange={handleChange} rows={3} className="mt-1 p-3 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className=" p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl p-6 sm:p-10 my-8">
        <header className="mb-8 text-center">
          <h1 className="text-2xl sm:text-4xl  text-gray-700">
            Create New Asset
          </h1>
        </header>

        <div className="flex justify-between items-center mb-8">
          {[...Array(totalSteps)].map((_, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${
                  currentStep > index
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {index + 1}
              </div>
              {index < totalSteps - 1 && (
                <div
                  className={`flex-grow h-1 mx-2 sm:mx-4 ${
                    currentStep > index + 1 ? "bg-blue-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form onKeyDown={handleKeyDown} className="space-y-8">
          {renderStep()}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-gray-300 transition duration-300 ease-in-out"
              >
                Previous
              </button>
            )}
            <div className="flex-grow"></div>
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-blue-700 transition duration-300 ease-in-out"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="bg-green-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-green-700 transition duration-300 ease-in-out"
              >
                Submit
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
