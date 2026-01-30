"use client";

import { useState, useEffect } from "react";
import ManualLeadModal from "@/components/models/ManualLeadModal";
import { redirect } from "next/dist/server/api-utils";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LeadDistributionPage() {
  const [reps, setReps] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [distribution, setDistribution] = useState([]);
  const [latestLeads, setLatestLeads] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [repSearch, setRepSearch] = useState("");
  const [savingUsernames, setSavingUsernames] = useState({});
  const [justSaved, setJustSaved] = useState({});
  const [priorityTouched, setPriorityTouched] = useState({});
  const [maxTouched, setMaxTouched] = useState({});
  const router = useRouter();

  const filteredLeads = latestLeads.filter((lead) => {
    return (
      lead.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.products_interest.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.assigned_to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.sales_representative
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      new Date(lead.date_created)
        .toLocaleString()
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  });

  const fetchData = async () => {
    const repsRes = await fetch("/api/lead-distribution/reps");
    const distRes = await fetch("/api/lead-distribution");

    let url = "/api/lead-distribution/latest-leads";
    if (fromDate && toDate) {
      url += `?from=${fromDate}&to=${toDate}`;
    }

    const leadsRes = await fetch(url);
    const [repsData, distData, leadsData] = await Promise.all([
      repsRes.json(),
      distRes.json(),
      leadsRes.json(),
    ]);

    setReps(repsData);
    setDistribution(distData);
    setLatestLeads(leadsData);
    console.log("Lead distribution ", repsData, distData, leadsData);
    setPriorityTouched({});
    setMaxTouched({});
  };

  useEffect(() => {
    if (fromDate && toDate && toDate < fromDate) {
      setToDate("");
    }
    fetchData();
  }, [fromDate, toDate]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-700 text-center">
        Lead Distribution Dashboard
      </h1>

      {/* 🔹 Toggle Button (legacy form removed). Manual assign retained */}
      <div className="flex justify-end items-center mb-6">
        <button
          onClick={() => router.push("/admin-dashboard/meta-backfill")}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow"
        >
          Meta BackFill
        </button>
      </div>

      {/* 🔹 Rep Search & Add */}
      <div className="bg-white border rounded p-4 shadow">
        <h2 className="font-semibold mb-2">Add Representative</h2>
        <input
          type="text"
          className="mb-3 p-2 border rounded w-full"
          placeholder="Search user by username"
          value={repSearch}
          onChange={(e) => setRepSearch(e.target.value)}
        />
        {repSearch && (
          <div className="max-h-48 overflow-auto border rounded">
            {reps
              .map((r) => r.username || r)
              .filter((u) => u.toLowerCase().includes(repSearch.toLowerCase()))
              .filter(
                (u) =>
                  !distribution.some(
                    (d) => (d.username || d).toLowerCase() === u.toLowerCase(),
                  ),
              )
              .slice(0, 20)
              .map((u) => (
                <button
                  key={u}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b"
                  onClick={async () => {
                    setSavingUsernames((s) => ({ ...s, [u]: true }));
                    try {
                      await fetch("/api/lead-distribution", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          username: u,
                          priority: 0,
                          max_leads: 0,
                        }),
                      });
                      setDistribution((prev) =>
                        [
                          ...prev,
                          { username: u, priority: 0, max_leads: 0 },
                        ].sort((a, b) => (a.priority || 0) - (b.priority || 0)),
                      );
                      setPriorityTouched((s) => ({ ...s, [u]: false }));
                      setMaxTouched((s) => ({ ...s, [u]: false }));
                      setRepSearch("");
                    } finally {
                      setSavingUsernames((s) => ({ ...s, [u]: false }));
                    }
                  }}
                  disabled={!!savingUsernames[u]}
                >
                  {u}
                </button>
              ))}
            {reps.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">
                No users available
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🔹 Summary Bar */}
      <div className="bg-gray-100 border rounded p-4 shadow">
        <h2 className="font-semibold mb-2">Current Lead Distribution</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-2 border">Username</th>
                <th className="p-2 border">Priority</th>
                <th className="p-2 border">Max Leads</th>
                <th className="p-2 border w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {distribution.map((rep) => (
                <tr key={rep.username} className="border-t">
                  <td className="p-2 border font-semibold">{rep.username}</td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      className="w-full border rounded p-1"
                      value={
                        priorityTouched[rep.username]
                          ? rep.priority || ""
                          : (rep.priority ?? 0)
                      }
                      onFocus={() =>
                        setPriorityTouched((s) => ({
                          ...s,
                          [rep.username]: true,
                        }))
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = parseInt(raw, 10);
                        setDistribution((prev) =>
                          prev.map((r) =>
                            r.username === rep.username
                              ? { ...r, priority: Number.isNaN(v) ? 0 : v }
                              : r,
                          ),
                        );
                      }}
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      className="w-full border rounded p-1"
                      value={
                        maxTouched[rep.username]
                          ? rep.max_leads || ""
                          : (rep.max_leads ?? 0)
                      }
                      onFocus={() =>
                        setMaxTouched((s) => ({ ...s, [rep.username]: true }))
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = parseInt(raw, 10);
                        setDistribution((prev) =>
                          prev.map((r) =>
                            r.username === rep.username
                              ? { ...r, max_leads: Number.isNaN(v) ? 0 : v }
                              : r,
                          ),
                        );
                      }}
                    />
                  </td>
                  <td className="p-2 border">
                    <div className="flex items-center gap-2">
                      {justSaved[rep.username] && (
                        <span className="text-green-700 text-xs">Saved</span>
                      )}
                      <button
                        className="bg-green-600 text-white px-3 py-1 rounded"
                        onClick={async () => {
                          const payload = distribution.find(
                            (r) => r.username === rep.username,
                          );
                          setSavingUsernames((s) => ({
                            ...s,
                            [rep.username]: true,
                          }));
                          try {
                            await fetch("/api/lead-distribution", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(payload),
                            });
                            // Refresh from server for confidence
                            const fresh = await fetch("/api/lead-distribution");
                            const rows = await fresh.json();
                            setDistribution(rows);
                            setPriorityTouched({});
                            setMaxTouched({});
                            setJustSaved((s) => ({
                              ...s,
                              [rep.username]: true,
                            }));
                            setTimeout(() => {
                              setJustSaved((s) => ({
                                ...s,
                                [rep.username]: false,
                              }));
                            }, 1500);
                          } finally {
                            setSavingUsernames((s) => ({
                              ...s,
                              [rep.username]: false,
                            }));
                          }
                        }}
                        disabled={!!savingUsernames[rep.username]}
                      >
                        Save
                      </button>
                      <button
                        className="bg-red-600 text-white px-3 py-1 rounded"
                        onClick={async () => {
                          setSavingUsernames((s) => ({
                            ...s,
                            [rep.username]: true,
                          }));
                          try {
                            await fetch(
                              `/api/lead-distribution?username=${encodeURIComponent(
                                rep.username,
                              )}`,
                              { method: "DELETE" },
                            );
                            setDistribution((prev) =>
                              prev.filter((r) => r.username !== rep.username),
                            );
                            setPriorityTouched((s) => {
                              const { [rep.username]: _omit, ...rest } = s;
                              return rest;
                            });
                            setMaxTouched((s) => {
                              const { [rep.username]: _omit, ...rest } = s;
                              return rest;
                            });
                          } finally {
                            setSavingUsernames((s) => ({
                              ...s,
                              [rep.username]: false,
                            }));
                          }
                        }}
                        disabled={!!savingUsernames[rep.username]}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {distribution.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-gray-500" colSpan={4}>
                    No distribution configured. Use the search above to add
                    users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔹 Toggle Button (legacy form removed). Manual assign retained */}
      <div className="flex justify-end items-center mb-6">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow"
        >
          Manually Assign Leads
        </button>
      </div>

      {/* Legacy distribution form removed in favor of editable list above */}
      <ManualLeadModal show={showModal} onClose={() => setShowModal(false)} />

      {/* 🔹 Latest Leads Table */}
      <div className="bg-white border rounded p-6 shadow">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <h2 className="font-semibold text-lg">Latest Facebook Leads</h2>
          <div className="flex gap-4 flex-wrap items-center">
            <div>
              <label className="text-sm block mb-1 text-gray-700">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded p-2"
              />
            </div>
            <div>
              <label className="text-sm block mb-1 text-gray-700">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded p-2"
              />
            </div>
          </div>
        </div>

        <input
          type="text"
          className="mb-4 p-2 border rounded w-full"
          placeholder="Search by name, phone."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Desktop: Scrollable Fixed Container */}
        <div className="hidden lg:block max-h-[500px] overflow-auto border rounded">
          <span>
            <h2>Count: {filteredLeads.length}</h2>
          </span>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left sticky top-0 z-10">
              <tr>
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Phone</th>
                <th className="p-2 border">Product</th>
                <th className="p-2 border">Assigned By</th>
                <th className="p-2 border">Sales Rep</th>
                <th className="p-2 border">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.customer_id} className="border-t">
                  <td className="p-2 border">{lead.first_name}</td>
                  <td className="p-2 border">{lead.phone}</td>
                  <td className="p-2 border">{lead.products_interest}</td>
                  <td className="p-2 border font-semibold text-blue-600">
                    {lead.assigned_to}
                  </td>
                  <td className="p-2 border font-semibold text-blue-600">
                    {lead.sales_representative || "-"}
                  </td>
                  <td className="p-2 border">
                    {new Date(lead.date_created).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Card View */}
        <div className="lg:hidden space-y-4">
          {filteredLeads.map((lead) => (
            <div
              key={lead.customer_id}
              className="border p-4 rounded shadow bg-gray-50"
            >
              <p>
                <strong>Name:</strong> {lead.first_name}
              </p>
              <p>
                <strong>Phone:</strong> {lead.phone}
              </p>
              <p>
                <strong>Product:</strong> {lead.products_interest}
              </p>
              <p>
                <strong>Assigned By:</strong>{" "}
                <span className="text-blue-600 font-semibold">
                  {lead.assigned_to}
                </span>
              </p>
              <p>
                <strong>Sales Rep:</strong>{" "}
                <span className="text-blue-600 font-semibold">
                  {lead.sales_representative || "-"}
                </span>
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {new Date(lead.date_created).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
