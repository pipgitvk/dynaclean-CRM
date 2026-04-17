// app/admin-dashboard/quick-edit/[username]/page.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  MODULE_TREE,
  ALL_MODULE_KEYS,
  getChildKeys,
  applySuperadminOnlyModuleRestrictions,
  applyRoleDenyModuleRestrictions,
} from "@/lib/moduleAccess";

function uniqueStrings(arr) {
  return [...new Set((arr || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

/* ── Tri-state parent checkbox ── */
function ParentCheckbox({ sectionKey, selected, canEdit, onChange }) {
  const childKeys = getChildKeys(sectionKey);
  const hasChildren = childKeys.length > 0;

  const checkedCount = hasChildren
    ? childKeys.filter((k) => selected.includes(k)).length
    : selected.includes(sectionKey)
    ? 1
    : 0;

  const total = hasChildren ? childKeys.length : 1;
  const allChecked = checkedCount === total;
  const someChecked = checkedCount > 0 && checkedCount < total;

  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked;
  }, [someChecked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allChecked}
      onChange={onChange}
      disabled={!canEdit}
      className="w-4 h-4 accent-blue-600 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
    />
  );
}

/* ── Section accordion block ── */
function SectionBlock({ section, selected, canEdit, onToggleParent, onToggleChild }) {
  const [open, setOpen] = useState(true);
  const hasChildren = section.children.length > 0;

  const childKeys = section.children.map((c) => c.key);
  const checkedCount = hasChildren
    ? childKeys.filter((k) => selected.includes(k)).length
    : selected.includes(section.key)
    ? 1
    : 0;
  const total = hasChildren ? childKeys.length : 1;
  const allChecked = checkedCount === total;
  const noneChecked = checkedCount === 0;

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        allChecked
          ? "border-blue-300 bg-blue-50/40"
          : noneChecked
          ? "border-gray-200 bg-white"
          : "border-amber-200 bg-amber-50/30"
      }`}
    >
      {/* Parent header */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ParentCheckbox
            sectionKey={section.key}
            selected={selected}
            canEdit={canEdit}
            onChange={() => onToggleParent(section)}
          />
          <span
            className={`text-sm font-semibold truncate ${
              allChecked
                ? "text-blue-800"
                : noneChecked
                ? "text-gray-500"
                : "text-amber-800"
            }`}
          >
            {section.label}
          </span>
          {hasChildren && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              ({checkedCount}/{total})
            </span>
          )}
        </div>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-xs px-1"
            title={open ? "Collapse" : "Expand"}
          >
            {open ? "▲" : "▼"}
          </button>
        )}
      </div>

      {/* Children grid */}
      {hasChildren && open && (
        <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-gray-100">
          {section.children.map((child) => {
            const isChecked = selected.includes(child.key);
            return (
              <label
                key={child.key}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors text-xs ${
                  isChecked
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : "bg-white border-gray-100 text-gray-500 hover:border-blue-200"
                } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => canEdit && onToggleChild(child.key)}
                  disabled={!canEdit}
                  className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                />
                <span className="leading-tight">{child.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
const QuickEditPage = () => {
  const { username } = useParams();
  const router = useRouter();
  const [employee, setEmployee] = useState({
    username: "",
    email: "",
    dob: "",
    number: "",
    address: "",
    state: "",
    userRole: "",
    profile_pic: "",
    status: 0,
  });
  const [canEditEmployeeStatus, setCanEditEmployeeStatus] = useState(false);
  const [canEditModuleAccess, setCanEditModuleAccess] = useState(false);
  const [selectedModules, setSelectedModules] = useState([]);
  const [newProfilePic, setNewProfilePic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moduleSearch, setModuleSearch] = useState("");
  const didHydrateModulesRef = useRef(false);
  const userEditedModulesRef = useRef(false);

  const today = new Date().toISOString().split("T")[0];

  const moduleIndex = MODULE_TREE.flatMap((section) =>
    (section.children?.length ? section.children : [{ key: section.key, label: section.label }]).map(
      (child) => ({
        key: child.key,
        label: child.label,
        sectionKey: section.key,
        sectionLabel: section.label,
      }),
    ),
  );

  const moduleSuggestions = (() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return [];
    const matches = moduleIndex
      .filter((m) => String(m.label || "").toLowerCase().includes(q))
      .slice(0, 12);
    return matches;
  })();

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        const response = await fetch(`/api/employees/${username}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch employee data.");
        const data = await response.json();

        const emp = data.employee || {};
        setEmployee({ ...emp, status: emp.status == null ? 0 : Number(emp.status) });
        setCanEditEmployeeStatus(!!data.canEditEmployeeStatus);
        setCanEditModuleAccess(!!data.canEditModuleAccess);

        // IMPORTANT: render exactly what's stored in DB in the checkbox UI.
        // Do not silently strip keys on load (that feels like "ticks removed by themselves").
        // Enforcement happens on SAVE instead.
        if (userEditedModulesRef.current && didHydrateModulesRef.current) {
          // User started editing; don't let a duplicate fetch (e.g. React StrictMode) reset UI.
        } else if (Array.isArray(emp.module_access)) {
          setSelectedModules(emp.module_access);
          didHydrateModulesRef.current = true;
        } else {
          setSelectedModules([...ALL_MODULE_KEYS]);
          didHydrateModulesRef.current = true;
        }
      } catch (err) {
        setError(err.message);
        toast.error("Failed to load employee data.");
      } finally {
        setLoading(false);
      }
    };

    if (username) fetchEmployeeData();
  }, [username]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "number") {
      const sanitized = value.replace(/\D/g, "");
      if (sanitized.length <= 10)
        setEmployee((prev) => ({ ...prev, [name]: sanitized }));
    } else {
      setEmployee((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) setNewProfilePic(file);
  };

  /* Toggle individual child key */
  const toggleChild = (key) => {
    userEditedModulesRef.current = true;
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  /* Toggle entire parent section (all children + parent key) */
  const toggleParent = (section) => {
    userEditedModulesRef.current = true;
    const hasChildren = section.children.length > 0;
    const childKeys = section.children.map((c) => c.key);
    const keys = hasChildren ? childKeys : [section.key];

    setSelectedModules((prev) => {
      const alreadyAllChecked = keys.every((k) => prev.includes(k));
      if (alreadyAllChecked) {
        // deselect all children (and parent key if stored)
        return prev.filter((k) => !keys.includes(k) && k !== section.key);
      } else {
        // select all children + parent key
        const next = new Set(prev);
        keys.forEach((k) => next.add(k));
        next.add(section.key);
        return [...next];
      }
    });
  };

  /* Select / deselect all modules */
  const toggleAll = () => {
    userEditedModulesRef.current = true;
    const allSelected = ALL_MODULE_KEYS.every((k) => selectedModules.includes(k));
    setSelectedModules(allSelected ? [] : [...ALL_MODULE_KEYS]);
  };

  const setAccountantDefaults = () => {
    userEditedModulesRef.current = true;
    const defaults = [
      "manual-payments",
      "dd-management",
      "company-documents",
      "client-expenses",
      "statements",
      "salary-slips",
      "sales-target",
      "invoices",
      "payment-pending",
      "customer-payment-behavior",
      "attendance-log",
      "quotations",
      "expenses",
      "service-records",
      "assets",
      "product-stock",
      "product-accessories",
      "purchase-direct-in",
      "purchase-request",
      "purchase-warehouse-in",
      "purchases",
      "spare-parts",
      "spare-direct-in",
      "spare-request",
      "spare-warehouse-in",
      "spare-purchases",
      "production-status",
      "bom-list",
      "employee-crm",
    ]
      .filter((k) => ALL_MODULE_KEYS.includes(k))
      .filter((k) => k !== "dm-fresh-leads");

    const effective = applySuperadminOnlyModuleRestrictions(defaults, employee.userRole);
    setSelectedModules(Array.isArray(effective) ? effective : []);
  };

  const setTeamLeaderDefaults = () => {
    userEditedModulesRef.current = true;
    const defaults = [
      "tl-customers",
      "view-customers",
      "add-customer",
      "employee-crm",
      "lead-reports",
      "quotations-report",
      "order-report",
      "demo-followups",
      "item-wise-sales",
      "customer-payment-behavior",
      "payment-pending",
      "leads-upload",
      "my-leads",
    ]
      .filter((k) => ALL_MODULE_KEYS.includes(k))
      .filter((k) => k !== "dm-fresh-leads");

    const effective = applySuperadminOnlyModuleRestrictions(defaults, employee.userRole);
    setSelectedModules(Array.isArray(effective) ? effective : []);
  };

  const setSalesDefaults = () => {
    userEditedModulesRef.current = true;
    const defaults = [
      "orders-process",
      "orders-delay",
    ]
      .filter((k) => ALL_MODULE_KEYS.includes(k))
      .filter((k) => k !== "dm-fresh-leads");

    const effective = applySuperadminOnlyModuleRestrictions(defaults, employee.userRole);
    setSelectedModules(Array.isArray(effective) ? effective : []);
  };

  const setDigitalMarketerDefaults = () => {
    userEditedModulesRef.current = true;
    const defaults = [
      "leads-upload",
      "blog",
      "my-leads",
      "quotations",
      "email-templates",
      "product-stock",
      "spare-parts",
      "employee-crm",
    ]
      .filter((k) => ALL_MODULE_KEYS.includes(k))
      .filter((k) => k !== "dm-fresh-leads");

    const effective = applySuperadminOnlyModuleRestrictions(defaults, employee.userRole);
    setSelectedModules(Array.isArray(effective) ? effective : []);
  };

  const setAdminDefaults = () => {
    userEditedModulesRef.current = true;
    const defaults = [
      // Dashboard (admin should see these by default)
      "dashboard-home",
      "lead-reports",
      "daily-report",
      "attendance-details",
      "regularization-approvals",
      "task-manager",
      "expenses",
      "fast-card",
      // Prospects
      "prospects-view",
      "prospects-add",
      "prospects-new",
      // Reports
      "customer-payment-behavior",
      "payment-pending",
      // Payments / docs
      "manual-payments",
      "company-documents",
      "dd-management",
      // Admin tools
      "attendance-rules",
      // TL management
      "quotations",
      "service-records",
      // Products & ops
      "warranty-console",
      "registered-products",
      "warranty-map",
      "product-stock",
      "product-accessories",
      "purchase-direct-in",
      "purchase-request",
      "purchase-warehouse-in",
      "purchases",
      "spare-parts",
      "spare-direct-in",
      "spare-request",
      "spare-warehouse-in",
      "spare-purchases",
      "production-status",
      "bom-list",
      // Employee CRM
      "employee-crm",
    ]
      .filter((k) => ALL_MODULE_KEYS.includes(k))
      .filter((k) => k !== "dm-fresh-leads");
    

    const effective = applySuperadminOnlyModuleRestrictions(defaults, employee.userRole);
    setSelectedModules(Array.isArray(effective) ? effective : []);
  };

  const setHrDefaults = () => {
    userEditedModulesRef.current = true;
    const defaults = [
      // Dashboard essentials
      "dashboard-home",
      "attendance-details",
      "regularization-approvals",
      "fast-card",
      // Employee + EMPCRM
      "employee-list",
      "employee-crm",
      // Attendance rules
      "attendance-rules",
      // Hiring (EMPCRM admin)
      "hiring-process",
    ]
      .filter((k) => ALL_MODULE_KEYS.includes(k))
      .filter((k) => k !== "dm-fresh-leads");

    const effective = applySuperadminOnlyModuleRestrictions(defaults, employee.userRole);
    setSelectedModules(Array.isArray(effective) ? effective : []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dob = new Date(employee.dob);
    const age = new Date().getFullYear() - dob.getFullYear();
    const monthDiff = new Date().getMonth() - dob.getMonth();
    const dayDiff = new Date().getDate() - dob.getDate();

    if (age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)))) {
      toast.error("Employee must be at least 18 years old.");
      setLoading(false);
      return;
    }
    if (employee.number.length !== 10) {
      toast.error("Phone number must be exactly 10 digits.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("email", employee.email);
    formData.append("dob", employee.dob);
    formData.append("number", employee.number);
    formData.append("address", employee.address);
    formData.append("state", employee.state);
    formData.append("userRole", employee.userRole);
    if (canEditEmployeeStatus)
      formData.append("status", String(employee.status === 1 ? 1 : 0));
    if (canEditModuleAccess) {
      const known = new Set(ALL_MODULE_KEYS);
      const before = uniqueStrings(selectedModules);
      const cleanedUnknown = before.filter((k) => known.has(k));
      const enforced =
        applyRoleDenyModuleRestrictions(
          applySuperadminOnlyModuleRestrictions(cleanedUnknown, employee.userRole) ?? [],
          employee.userRole,
        ) ?? [];
      const toSave = uniqueStrings(enforced);

      if (toSave.length !== before.length) {
        toast.error("Some invalid/superadmin-only/HR-blocked modules were removed before saving.");
      }

      // Keep UI aligned with what will actually persist
      setSelectedModules(toSave);
      formData.append("module_access", JSON.stringify(toSave));
    }
    if (newProfilePic) {
      formData.append("profile_pic", newProfilePic);
    } else {
      formData.append("current_profile_pic", employee.profile_pic);
    }

    try {
      const response = await fetch(`/api/employees/${username}`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.message || "Failed to update employee data.");
      toast.success("Employee data updated successfully!");
      router.push("/admin-dashboard/employees");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen text-lg text-gray-600">
        Loading...
      </div>
    );

  if (error)
    return (
      <div className="flex justify-center items-center h-screen text-lg text-red-600">
        Error: {error}
      </div>
    );

  const profileImageSrc = newProfilePic
    ? URL.createObjectURL(newProfilePic)
    : employee.profile_pic;

  const totalSelected = selectedModules.length;
  const totalAll = ALL_MODULE_KEYS.length;
  const allSelected = totalSelected === totalAll;

  return (
    <div className="bg-white shadow-md rounded-lg p-8 max-w-2xl mx-auto my-10">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Quick Edit: {employee.username}
        </h1>
        <span
          className={`inline-flex px-4 py-1.5 rounded-full text-sm font-semibold ${
            employee.status == 1
              ? "bg-emerald-100 text-emerald-800"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          {employee.status == 1 ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Profile picture preview */}
      <div className="flex justify-center mb-6">
        {(profileImageSrc && profileImageSrc.startsWith("/employees")) || newProfilePic ? (
          <Image
            src={profileImageSrc}
            alt="Profile Picture"
            width={150}
            height={150}
            className="rounded-full border-4 border-blue-200 object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center w-[150px] h-[150px] rounded-full border-4 border-gray-300 bg-gray-100 text-gray-500">
            Profile
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Profile Picture</label>
            <input
              type="file"
              name="profile_pic"
              onChange={handleImageChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              accept="image/*"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={employee.email || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={employee.dob || ""}
              onChange={handleInputChange}
              max={today}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Number</label>
            <input
              type="text"
              name="number"
              value={employee.number || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="e.g., 9876543210"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <input
              type="text"
              name="address"
              value={employee.address || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">State</label>
            <input
              type="text"
              name="state"
              value={employee.state || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">User Role</label>
            <input
              type="text"
              name="userRole"
              value={employee.userRole || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            {canEditEmployeeStatus ? (
              <select
                name="status"
                value={employee.status == 1 ? "1" : "0"}
                onChange={(e) =>
                  setEmployee((prev) => ({
                    ...prev,
                    status: e.target.value === "1" ? 1 : 0,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            ) : (
              <p className="mt-1 text-gray-800">{employee.status == 1 ? "Active" : "Inactive"}</p>
            )}
          </div>
        </div>

        {/* ── Access Modules ── */}
        <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Access Modules</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {canEditModuleAccess
                  ? `${totalSelected} / ${totalAll} modules selected — click a section header checkbox to toggle all its sub-modules`
                  : `${totalSelected} / ${totalAll} modules accessible`}
              </p>
            </div>
            {canEditModuleAccess && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative hidden sm:block">
                  <input
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    placeholder="Search modules…"
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-300 bg-white w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  {moduleSuggestions.length > 0 && (
                    <div className="absolute right-0 mt-1 w-[360px] max-w-[80vw] bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                      <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-100">
                        Suggestions
                      </div>
                      <div className="max-h-64 overflow-auto">
                        {moduleSuggestions.map((m) => {
                          const checked = selectedModules.includes(m.key);
                          return (
                            <button
                              key={`${m.sectionKey}:${m.key}`}
                              type="button"
                              onClick={() => {
                                if (!canEditModuleAccess) return;
                                toggleChild(m.key);
                                setModuleSearch("");
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between gap-2 ${
                                checked ? "text-blue-800" : "text-gray-700"
                              }`}
                              title={`${m.sectionLabel} → ${m.label}`}
                            >
                              <span className="min-w-0">
                                <span className="font-medium truncate block">{m.label}</span>
                                <span className="text-[11px] text-gray-500 truncate block">
                                  {m.sectionLabel}
                                </span>
                              </span>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0 ${
                                  checked
                                    ? "bg-blue-50 border-blue-200 text-blue-700"
                                    : "bg-gray-50 border-gray-200 text-gray-600"
                                }`}
                              >
                                {checked ? "Selected" : "Select"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {String(employee.userRole || "").trim().toUpperCase() === "ACCOUNTANT" && (
                  <button
                    type="button"
                    onClick={setAccountantDefaults}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    title="Set recommended defaults for Accountant"
                  >
                    Set Accountant Defaults
                  </button>
                )}
                {String(employee.userRole || "").trim().toUpperCase() === "TEAM LEADER" && (
                  <button
                    type="button"
                    onClick={setTeamLeaderDefaults}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                    title="Set recommended defaults for Team Leader"
                  >
                    Set TL Defaults
                  </button>
                )}
                {["SALES", "SALES HEAD"].includes(
                  String(employee.userRole || "").trim().toUpperCase(),
                ) && (
                  <button
                    type="button"
                    onClick={setSalesDefaults}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                    title="Set recommended defaults for Sales"
                  >
                    Set Sales Defaults
                  </button>
                )}
                {String(employee.userRole || "").trim().toUpperCase() ===
                  "DIGITAL MARKETER" && (
                  <button
                    type="button"
                    onClick={setDigitalMarketerDefaults}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 transition-colors"
                    title="Set recommended defaults for Digital Marketer"
                  >
                    Set DM Defaults
                  </button>
                )}
                {String(employee.userRole || "").trim().toUpperCase() === "ADMIN" && (
                  <button
                    type="button"
                    onClick={setAdminDefaults}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Set recommended defaults for Admin"
                  >
                    Set Admin Defaults
                  </button>
                )}
                {["HR", "HR HEAD", "HR EXECUTIVE"].includes(
                  String(employee.userRole || "").trim().toUpperCase(),
                ) && (
                  <button
                    type="button"
                    onClick={setHrDefaults}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                    title="Set recommended defaults for HR"
                  >
                    Set HR Defaults
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleAll}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    allSelected
                      ? "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"
                      : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
            )}
          </div>

          {/* Module tree */}
          <div className="p-4 space-y-3">
            {MODULE_TREE.map((section) => (
              <SectionBlock
                key={section.key}
                section={section}
                selected={selectedModules}
                canEdit={canEditModuleAccess}
                onToggleParent={toggleParent}
                onToggleChild={toggleChild}
              />
            ))}
          </div>

          {totalSelected === 0 && canEditModuleAccess && (
            <p className="px-4 pb-3 text-xs text-amber-600 font-medium">
              ⚠ No modules selected — user will not see anything in the CRM.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuickEditPage;
