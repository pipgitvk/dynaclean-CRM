"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Plus, Edit2, Trash2, Power, PowerOff, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Database, Eye, ArrowRight, Tag, Copy } from "lucide-react";
import Link from "next/link";
import { useMetaCredentialsPaths } from "@/hooks/useMetaCredentialsPaths";
import { metaLeadsToolBase } from "@/lib/metaCredentialsPaths";
import { usePathname } from "next/navigation";

/**
 * @param {"admin" | "marketer"} variant — marketer: list, add, edit, view, toggle active only
 */
export default function MetaCredentialsManageClient({ variant = "admin" }) {
  const isMarketer = variant === "marketer";
  const paths = useMetaCredentialsPaths();
  const pathname = usePathname() || "";
  const dashBase = metaLeadsToolBase(pathname);

  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cronStatus, setCronStatus] = useState(null);
  const [cronInterval, setCronInterval] = useState(1);

  useEffect(() => {
    fetchCredentials();
    if (!isMarketer) {
      fetchCronStatus();
    }
  }, [isMarketer]);

  useEffect(() => {
    if (!isMarketer && cronStatus?.interval) {
      setCronInterval(cronStatus.interval);
    }
  }, [cronStatus, isMarketer]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchCredentials();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/meta-credentials");
      if (response.data.success) {
        setCredentials(response.data.data);
      }
    } catch (error) {
      toast.error("Failed to fetch credentials");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCronStatus = async () => {
    try {
      const response = await axios.get("/api/cron/meta-leads-sync?action=status");
      if (response.data.success) {
        setCronStatus(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch cron status");
    }
  };

  const handleToggleActive = async (id) => {
    try {
      const response = await axios.post(`/api/meta-credentials/${id}/toggle`);
      if (response.data.success) {
        toast.success(response.data.message);
        fetchCredentials();
      }
    } catch (error) {
      toast.error("Failed to toggle credential");
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this credential?")) return;
    try {
      const response = await axios.delete(`/api/meta-credentials/${id}`);
      if (response.data.success) {
        toast.success("Credential deleted successfully");
        fetchCredentials();
      }
    } catch (error) {
      toast.error("Failed to delete credential");
      console.error(error);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const response = await axios.get("/api/cron/meta-leads-sync?action=manual-sync&autoImport=true");
      if (response.data.success) {
        const totalFetched = response.data.data.reduce((sum, r) => sum + r.leadsFetched, 0);
        const totalImported = response.data.data.reduce((sum, r) => sum + r.leadsImported, 0);
        toast.success(`Sync completed: Fetched ${totalFetched} leads, Imported ${totalImported}`);
        fetchCredentials();
      }
    } catch (error) {
      toast.error("Failed to sync leads");
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleCron = async () => {
    try {
      const action = cronStatus?.isRunning ? "stop" : "start";
      const response = await axios.post("/api/cron/meta-leads-sync", { action, interval: cronInterval });
      if (response.data.success) {
        toast.success(response.data.message);
        fetchCronStatus();
      }
    } catch (error) {
      toast.error("Failed to toggle cron");
      console.error(error);
    }
  };

  const handleIntervalChange = (value) => {
    setCronInterval(parseInt(value, 10));
  };

  const handleUpdateInterval = async () => {
    if (!cronStatus?.isRunning) return;
    try {
      const response = await axios.post("/api/cron/meta-leads-sync", { action: "restart", interval: cronInterval });
      if (response.data.success) {
        toast.success(`Cron interval updated to ${cronInterval} minute(s)`);
        fetchCronStatus();
      }
    } catch (error) {
      toast.error("Failed to update cron interval");
      console.error(error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
          {isMarketer ? "Meta Leads Forms" : "Meta Credentials Management"}
        </h1>
        <p className="text-sm text-gray-600 md:text-base">
          {isMarketer
            ? "Add Facebook lead forms, edit tokens, and activate or deactivate syncing."
            : "Manage multiple Meta Facebook Lead credentials for different employees"}
        </p>
      </div>

      {!isMarketer ? (
        <div className="mb-6 rounded-lg bg-white p-4 shadow-md md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <h2 className="mb-2 text-lg font-semibold text-gray-900 md:text-xl">Automatic Cron Status</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                {cronStatus?.isRunning ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
                    <span className="font-medium">Running</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="font-medium">Stopped</span>
                  </div>
                )}
                <span className="text-sm text-gray-500">Schedule: Every {cronStatus?.interval || 1} minute(s)</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Interval (min):</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={cronInterval}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleUpdateInterval}
                  disabled={!cronStatus?.isRunning}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Update
                </button>
              </div>
              <button
                type="button"
                onClick={handleToggleCron}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium ${
                  cronStatus?.isRunning
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {cronStatus?.isRunning ? (
                  <>
                    <PowerOff className="h-4 w-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4" />
                    Start
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={paths.add}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add New Form
        </Link>
        {!isMarketer ? (
          <>
            <Link
              href={paths.skippedLeads}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700"
            >
              <Database className="h-4 w-4" />
              Skipped Leads
            </Link>
            <Link
              href={paths.duplicateLeads}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              <Copy className="h-4 w-4" />
              Duplicate Leads
            </Link>
            <Link
              href={paths.importedLeads}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Imported Leads
            </Link>
            <Link
              href={paths.metaLogs}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700"
            >
              <Clock className="h-4 w-4" />
              View Logs
            </Link>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {credentials.length === 0 ? (
          <div className="col-span-full rounded-lg bg-white p-8 text-center shadow-md md:p-12">
            <h3 className="mb-2 text-base font-medium text-gray-900 md:text-lg">No forms added yet</h3>
            <p className="mb-4 text-sm text-gray-500 md:text-base">Add your first Meta lead form to start syncing</p>
            <Link
              href={paths.add}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Form
            </Link>
          </div>
        ) : (
          credentials.map((cred) => (
            <div key={cred._id} className="rounded-lg bg-white p-4 shadow-md md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 md:text-xl">
                      {cred.employeeName || "Lead form"}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        cred.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {cred.isActive ? "Active" : "Inactive"}
                    </span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(cred.lastSyncStatus)}
                      <span className="text-sm capitalize text-gray-600">{cred.lastSyncStatus || "—"}</span>
                    </div>
                    {cred.latestProductInterest ? (
                      <span
                        className="inline-flex max-w-[240px] items-center gap-1 truncate rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 sm:max-w-[360px]"
                        title={cred.latestProductInterest}
                      >
                        <Tag className="h-3 w-3 shrink-0" />
                        <span className="truncate">{cred.latestProductInterest}</span>
                      </span>
                    ) : null}
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 md:text-sm">Page ID</label>
                      <p className="break-all font-mono text-xs text-gray-900 md:text-sm">{cred.pageId}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 md:text-sm">Form IDs</label>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(cred.formIds) && cred.formIds.length > 0 ? (
                          cred.formIds.map((formId, idx) => (
                            <span key={idx} className="rounded bg-blue-50 px-2 py-1 font-mono text-xs text-blue-700">
                              {formId}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">No form IDs</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 md:text-sm">Leads imported</label>
                      <p className="text-lg font-semibold text-gray-900 md:text-base">{cred.totalLeadsImported || 0}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 md:text-sm">Last sync</label>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400 md:h-4 md:w-4" />
                        <p className="text-xs text-gray-900 md:text-sm">
                          {cred.lastSyncAt
                            ? new Date(`${cred.lastSyncAt}Z`).toLocaleString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: false,
                              })
                            : "Never"}
                        </p>
                      </div>
                    </div>
                    {cred.lastSyncMessage ? (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-xs font-medium text-gray-500 md:text-sm">Last sync message</label>
                        <p className="text-xs text-gray-700 md:text-sm">{cred.lastSyncMessage}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 md:ml-4">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(cred._id)}
                    className={`rounded-lg p-2 ${
                      cred.isActive
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                    title={cred.isActive ? "Deactivate" : "Activate"}
                  >
                    {cred.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </button>
                  <Link
                    href={paths.view(cred._id)}
                    className="rounded-lg bg-purple-100 p-2 text-purple-700 hover:bg-purple-200"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  {!isMarketer ? (
                    <Link
                      href={`${dashBase}/ads-management?formIds=${encodeURIComponent(cred.formIds.join(","))}`}
                      className="rounded-lg bg-indigo-100 p-2 text-indigo-700 hover:bg-indigo-200"
                      title="Meta Backfill"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                  <Link
                    href={paths.edit(cred._id)}
                    className="rounded-lg bg-blue-100 p-2 text-blue-700 hover:bg-blue-200"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Link>
                  {!isMarketer ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(cred._id)}
                      className="rounded-lg bg-red-100 p-2 text-red-700 hover:bg-red-200"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}