"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function InstallationPage() {
  const params = useParams();
  const serialNumberFromRoute = params?.serial_number || "";

  const [form, setForm] = useState({
    serial_number: serialNumberFromRoute,
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
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Fetch rep list once on mount
  useEffect(() => {
    fetch("/api/reps")
      .then((res) => res.json())
      .then((data) => setRepList(data.users || []))
      .catch(() => setRepList([]));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/installation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Installation request submitted successfully!");
        setForm((f) => ({
          ...f,
          installation_address: "",
          site_person: "",
          site_email: "",
          site_contact: "",
        }));
      } else {
        setError(data.message || "Failed to submit request");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Add New Installation Request
      </h1>

      {success && <p className="mb-4 text-green-600">{success}</p>}
      {error && <p className="mb-4 text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="serial_number" value={form.serial_number} />

        <label className="block font-semibold">Service Type</label>
        <select
          name="service_type"
          value={form.service_type}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded px-3 py-2"
          disabled
        >
          <option value="INSTALLATION">INSTALLATION</option>
        </select>

        <label className="block font-semibold">Installation Address</label>
        <input
          type="text"
          name="installation_address"
          value={form.installation_address}
          onChange={handleChange}
          placeholder="Enter complete address"
          required
          className="w-full border border-gray-300 rounded px-3 py-2"
        />

        <label className="block font-semibold">Site Person Name</label>
        <input
          type="text"
          name="site_person"
          value={form.site_person}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2"
        />

        <label className="block font-semibold">Site Person Email</label>
        <input
          type="email"
          name="site_email"
          value={form.site_email}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2"
        />

        <label className="block font-semibold">Site Person Contact</label>
        <input
          type="tel"
          name="site_contact"
          value={form.site_contact}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2"
          pattern="[0-9+ -]{7,15}"
          title="Please enter a valid contact number"
        />

        <label className="block font-semibold">Assign to User</label>
        <select
          name="username"
          value={form.username}
          onChange={handleChange}
          required
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="">-- Select User --</option>
          {repList.map((rep) => (
            <option key={rep.username} value={rep.username}>
              {rep.username}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
