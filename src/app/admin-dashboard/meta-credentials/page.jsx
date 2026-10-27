'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Power, PowerOff, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Database, Eye, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MetaCredentialsPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cronStatus, setCronStatus] = useState(null);
  const [cronInterval, setCronInterval] = useState(1);

  useEffect(() => {
    fetchCredentials();
    fetchCronStatus();
  }, []);

  // Sync interval from cronStatus
  useEffect(() => {
    if (cronStatus?.interval) {
      setCronInterval(cronStatus.interval);
    }
  }, [cronStatus]);

  // Refresh when page becomes visible (navigation back from edit/add)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchCredentials();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/meta-credentials');
      if (response.data.success) {
        setCredentials(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch credentials');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCronStatus = async () => {
    try {
      const response = await axios.get('/api/cron/meta-leads-sync?action=status');
      if (response.data.success) {
        setCronStatus(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch cron status');
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      const response = await axios.post(`/api/meta-credentials/${id}/toggle`);
      if (response.data.success) {
        toast.success(response.data.message);
        fetchCredentials();
      }
    } catch (error) {
      toast.error('Failed to toggle credential');
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;

    try {
      const response = await axios.delete(`/api/meta-credentials/${id}`);
      if (response.data.success) {
        toast.success('Credential deleted successfully');
        fetchCredentials();
      }
    } catch (error) {
      toast.error('Failed to delete credential');
      console.error(error);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const response = await axios.get('/api/cron/meta-leads-sync?action=manual-sync&autoImport=true');
      if (response.data.success) {
        const totalFetched = response.data.data.reduce((sum, r) => sum + r.leadsFetched, 0);
        const totalImported = response.data.data.reduce((sum, r) => sum + r.leadsImported, 0);
        toast.success(`Sync completed: Fetched ${totalFetched} leads, Imported ${totalImported}`);
        fetchCredentials();
      }
    } catch (error) {
      toast.error('Failed to sync leads');
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleCron = async () => {
    try {
      const action = cronStatus?.isRunning ? 'stop' : 'start';
      const response = await axios.post('/api/cron/meta-leads-sync', { action, interval: cronInterval });
      if (response.data.success) {
        toast.success(response.data.message);
        fetchCronStatus();
      }
    } catch (error) {
      toast.error('Failed to toggle cron');
      console.error(error);
    }
  };

  const handleAutoStartCron = async () => {
    try {
      const response = await axios.post('/api/cron/meta-leads-sync', { action: 'start', interval: cronInterval });
      if (response.data.success) {
        console.log('✅ Cron auto-started');
        fetchCronStatus();
      }
    } catch (error) {
      console.error('Failed to auto-start cron:', error);
    }
  };

  const handleIntervalChange = (value) => {
    const newInterval = parseInt(value);
    setCronInterval(newInterval);
  };

  const handleUpdateInterval = async () => {
    if (cronStatus?.isRunning) {
      try {
        const response = await axios.post('/api/cron/meta-leads-sync', { action: 'restart', interval: cronInterval });
        if (response.data.success) {
          toast.success(`Cron interval updated to ${cronInterval} minute(s)`);
          fetchCronStatus();
        }
      } catch (error) {
        toast.error('Failed to update cron interval');
        console.error(error);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Meta Credentials Management</h1>
        <p className="text-gray-600 text-sm md:text-base">Manage multiple Meta Facebook Lead credentials for different employees</p>
      </div>

      {/* Cron Status Card */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">Automatic Cron Status</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                {cronStatus?.isRunning ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">Running</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="font-medium">Stopped</span>
                  </div>
                )}
                <span className="text-gray-500 text-sm">Schedule: Every {cronStatus?.interval || 1} minute(s)</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-end">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Interval (min):</label>
              <input
                type="number"
                min="1"
                max="60"
                value={cronInterval}
                onChange={(e) => handleIntervalChange(e.target.value)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleUpdateInterval}
                disabled={!cronStatus?.isRunning}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleToggleCron}
              className={`px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                cronStatus?.isRunning
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {cronStatus?.isRunning ? (
                <>
                  <PowerOff className="w-4 h-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" />
                  <span>Start</span>
                </>
              )}
            </button>
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Credential Button */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <Link
          href="/admin-dashboard/meta-credentials/add"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add New Credential
        </Link>
        <Link
          href="/admin-dashboard/skipped-leads"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
        >
          <Database className="w-4 h-4" />
          Skipped Leads
        </Link>
        <Link
          href="/admin-dashboard/imported-leads"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
        >
          <CheckCircle className="w-4 h-4" />
          Imported Leads
        </Link>
        <Link
          href="/admin-dashboard/meta-logs"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
        >
          <Clock className="w-4 h-4" />
          View Logs
        </Link>
      </div>

      {/* Credentials List */}
      <div className="grid grid-cols-1 gap-4">
        {credentials.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow-md p-8 md:p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 md:w-16 md:h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No credentials added yet</h3>
            <p className="text-gray-500 mb-4 text-sm md:text-base">Add your first Meta credential to start syncing leads</p>
            <Link
              href="/admin-dashboard/meta-credentials/add"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Credential
            </Link>
          </div>
        ) : (
          credentials.map((cred) => (
            <div key={cred._id} className="bg-white rounded-lg shadow-md p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                    <h3 className="text-lg md:text-xl font-semibold text-gray-900">{cred.employeeName}</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        cred.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {cred.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(cred.lastSyncStatus)}
                      <span className="text-sm text-gray-600 capitalize">{cred.lastSyncStatus}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4">
                    <div>
                      <label className="text-xs md:text-sm font-medium text-gray-500">Page ID</label>
                      <p className="text-gray-900 font-mono text-xs md:text-sm break-all">{cred.pageId}</p>
                    </div>
                    <div>
                      <label className="text-xs md:text-sm font-medium text-gray-500">Form IDs</label>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(cred.formIds) && cred.formIds.length > 0 ? (
                          cred.formIds.map((formId, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                              {formId}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">No form IDs</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs md:text-sm font-medium text-gray-500">Leads Imported to CRM</label>
                      <p className="text-gray-900 font-semibold text-lg md:text-base">{cred.totalLeadsImported || 0}</p>
                    </div>
                    <div>
                      <label className="text-xs md:text-sm font-medium text-gray-500">Last Sync</label>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
                        <p className="text-gray-900 text-xs md:text-sm">
                          {cred.lastSyncAt
                            ? new Date(cred.lastSyncAt + 'Z').toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              })
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                    {cred.lastSyncMessage && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-xs md:text-sm font-medium text-gray-500">Last Sync Message</label>
                        <p className="text-gray-700 text-xs md:text-sm">{cred.lastSyncMessage}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 md:ml-4 justify-end">
                  <button
                    onClick={() => handleToggleActive(cred._id, cred.isActive)}
                    className={`p-2 rounded-lg ${
                      cred.isActive
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title={cred.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {cred.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  <Link
                    href={`/admin-dashboard/meta-credentials/${cred._id}/view`}
                    className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/admin-dashboard/ads-management?formIds=${encodeURIComponent(cred.formIds.join(','))}`}
                    className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                    title="Meta Backfill"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/admin-dashboard/meta-credentials/${cred._id}/edit`}
                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(cred._id)}
                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
