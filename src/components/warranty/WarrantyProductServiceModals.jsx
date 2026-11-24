"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import EditWarrantyPage from "@/app/admin-dashboard/warranty/edit/[serial_number]/page";

export function WarrantyFormModalShell({ title, onClose, children, wide = false }) {
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div
        className={`relative flex max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${
          wide ? "w-full max-w-5xl" : "w-full max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800 sm:text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 transition-colors hover:text-gray-800"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function WarrantyInstallRequestModal({ serialNumber, onClose, onSuccess }) {
  const [form, setForm] = useState({
    serial_number: serialNumber,
    service_type: "INSTALLATION",
    installation_address: "",
    site_person: "",
    site_email: "",
    site_contact: "",
    status: "PENDING",
    username: "",
  });
  const [repList, setRepList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm((prev) => ({ ...prev, serial_number: serialNumber }));
  }, [serialNumber]);

  useEffect(() => {
    fetch("/api/reps")
      .then((r) => r.json())
      .then((d) => setRepList(d.users || []))
      .catch(() => setRepList([]));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/installation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Installation request submitted successfully!");
        onSuccess?.();
      } else {
        toast.error(data.message || "Failed to submit request");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <WarrantyFormModalShell title="Add New Installation Request" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="serial_number" value={form.serial_number} />
        <WarrantyModalField label="Serial number">
          <input
            type="text"
            readOnly
            value={form.serial_number}
            className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-800"
          />
        </WarrantyModalField>
        <div>
          <label className="mb-1 block text-sm font-semibold">Service Type</label>
          <select
            name="service_type"
            value={form.service_type}
            onChange={handleChange}
            className="w-full rounded border border-gray-300 px-3 py-2"
            disabled
          >
            <option value="INSTALLATION">INSTALLATION</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Installation Address</label>
          <input
            type="text"
            name="installation_address"
            value={form.installation_address}
            onChange={handleChange}
            placeholder="Enter complete address"
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Site Person Name</label>
          <input
            type="text"
            name="site_person"
            value={form.site_person}
            onChange={handleChange}
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Site Person Email</label>
          <input
            type="email"
            name="site_email"
            value={form.site_email}
            onChange={handleChange}
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Site Person Contact</label>
          <input
            type="tel"
            name="site_contact"
            value={form.site_contact}
            onChange={handleChange}
            required
            pattern="[0-9+ -]{7,15}"
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Assign to User</label>
          <select
            name="username"
            value={form.username}
            onChange={handleChange}
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="">-- Select User --</option>
            {repList.map((rep) => (
              <option key={rep.username} value={rep.username}>
                {rep.username}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-green-700 py-2 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
    </WarrantyFormModalShell>
  );
}

function WarrantyModalField({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}

export function WarrantyComplaintModal({ serialNumber, onClose, onSuccess }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    defaultValues: {
      serial_number: serialNumber,
      service_type: "COMPLAINT",
      complaint_date: new Date().toISOString().split("T")[0],
      complaint_summary: "",
      status: "PENDING",
      assigned_to: "NOT ASSIGNED",
      attachments: null,
    },
  });
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState([]);

  useEffect(() => {
    setValue("serial_number", serialNumber);
    fetch("/api/complaints")
      .then((r) => r.json())
      .then((d) => setUsers(d))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoadingUsers(false));
  }, [serialNumber, setValue]);

  useEffect(() => {
    const previews = attachmentFiles.map((file) => ({
      name: file.name,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setAttachmentPreviews(previews);
    return () => {
      previews.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
    };
  }, [attachmentFiles]);

  const handleAttachmentsChange = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setAttachmentFiles((prev) => [...prev, ...picked]);
    setValue("attachments", picked);
  };

  const removeAttachmentAt = (index) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const formData = new FormData();
    for (const key in data) {
      if (key === "attachments") continue;
      formData.append(key, data[key]);
    }
    for (const file of attachmentFiles) {
      formData.append("attachments", file);
    }
    try {
      const res = await fetch("/api/complaints", { method: "POST", body: formData });
      if (res.ok) {
        toast.success("Complaint added successfully!");
        reset();
        setAttachmentFiles([]);
        onSuccess?.();
      } else {
        const err = await res.json();
        toast.error(`Error: ${err.error || "Failed to add complaint."}`);
        setIsSubmitting(false);
      }
    } catch {
      toast.error("An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <WarrantyFormModalShell title="Add New Complaint" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register("serial_number")} />
        <input type="hidden" {...register("status")} />
        <WarrantyModalField label="Serial number">
          <input
            type="text"
            readOnly
            value={serialNumber}
            className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-800"
          />
        </WarrantyModalField>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Service Type</label>
          <select {...register("service_type")} className="w-full rounded border border-gray-300 px-3 py-2">
            <option value="COMPLAINT">COMPLAINT</option>
            <option value="PREVENTIVE MAINTENANCE">PREVENTIVE MAINTENANCE</option>
            <option value="TRAINING">TRAINING</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Complaint Date</label>
          <input
            type="date"
            {...register("complaint_date", { required: "Complaint Date is required" })}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
          {errors.complaint_date ? (
            <p className="mt-1 text-sm text-red-600">{errors.complaint_date.message}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Customer Complaint Summary</label>
          <textarea
            rows={4}
            {...register("complaint_summary", { required: "Complaint summary is required" })}
            className="w-full resize-y rounded border border-gray-300 px-3 py-2"
          />
          {errors.complaint_summary ? (
            <p className="mt-1 text-sm text-red-600">{errors.complaint_summary.message}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Assign to User</label>
          <select
            {...register("assigned_to")}
            className="w-full rounded border border-gray-300 px-3 py-2"
            disabled={loadingUsers}
          >
            {loadingUsers ? (
              <option>Loading users...</option>
            ) : (
              <>
                <option value="NOT ASSIGNED">NOT ASSIGNED</option>
                {users.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Attach files (optional, multiple)
          </label>
          <input
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            onChange={handleAttachmentsChange}
            className="w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />
          {attachmentPreviews.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2">
              {attachmentPreviews.map((item, idx) => (
                <li key={`${item.name}-${idx}`} className="flex items-center gap-2 text-sm text-gray-800">
                  {item.url ? (
                    <img
                      src={item.url}
                      alt=""
                      className="h-10 w-10 rounded border border-gray-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded border border-gray-200 bg-white text-[10px] text-gray-500">
                      FILE
                    </span>
                  )}
                  <span className="flex-1 truncate">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachmentAt(idx)}
                    className="text-xs font-semibold text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-red-700 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit Complaint"}
        </button>
      </form>
    </WarrantyFormModalShell>
  );
}

export function WarrantyProductEditModal({ serialNumber, onClose, onSuccess }) {
  const serial = String(serialNumber || "").trim();
  return (
    <WarrantyFormModalShell title="Edit registration" onClose={onClose} wide>
      {serial ? (
        <EditWarrantyPage
          serialNumberOverride={serial}
          forceEmbedded
          onCloseModal={() => {
            onSuccess?.();
            onClose();
          }}
        />
      ) : (
        <p className="py-6 text-center text-sm text-red-600">Missing serial number.</p>
      )}
    </WarrantyFormModalShell>
  );
}