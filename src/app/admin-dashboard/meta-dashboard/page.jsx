'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { 
  Users, 
  Database, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  Activity,
  RefreshCw
} from 'lucide-react';

export default function MetaDashboardPage() {
  const [stats, setStats] = useState({
    totalCredentials: 0,
    activeCredentials: 0,
    totalLeads: 0,
    importedLeads: 0,
    recentSyncs: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const [credentialsRes, leadsRes, syncLogsRes] = await Promise.all([
        axios.get('/api/meta-credentials'),
        axios.get('/api/meta-leads?limit=1000'),
        axios.get('/api/meta-leads/sync-logs?limit=10')
      ]);

      const credentials = credentialsRes.data.data || [];
      const leads = leadsRes.data.data || [];
      const syncLogs = syncLogsRes.data.data || [];

      setStats({
        totalCredentials: credentials.length,
        activeCredentials: credentials.filter(c => c.isActive).length,
        totalLeads: leads.length,
        importedLeads: leads.filter(l => l.isImportedToCRM).length,
        recentSyncs: syncLogs
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  const getSyncStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Meta Lead Management Dashboard</h1>
          <p className="text-gray-600">Overview of your Meta Facebook Lead credentials and sync status</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalCredentials}</h3>
          <p className="text-sm text-gray-600 mt-1">Credentials Configured</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Active</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.activeCredentials}</h3>
          <p className="text-sm text-gray-600 mt-1">Active Credentials</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Leads</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalLeads}</h3>
          <p className="text-sm text-gray-600 mt-1">Total Leads Fetched</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Imported</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.importedLeads}</h3>
          <p className="text-sm text-gray-600 mt-1">Leads in CRM</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin-dashboard/meta-credentials"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Manage Credentials</h3>
              <p className="text-sm text-gray-500">Add, edit, or delete credentials</p>
            </div>
          </Link>

          <Link
            href="/admin-dashboard/meta-credentials"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">View Sync Logs</h3>
              <p className="text-sm text-gray-500">Check sync history and status</p>
            </div>
          </Link>

          <Link
            href="/admin-dashboard/meta-credentials"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Control Cron</h3>
              <p className="text-sm text-gray-500">Start/stop automatic sync</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Sync Logs */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Sync Activity</h2>
          <Link
            href="/admin-dashboard/meta-sync-logs"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View All Logs
          </Link>
        </div>
        
        {stats.recentSyncs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No sync activity yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.recentSyncs.map((log) => (
              <div key={log._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getSyncStatusIcon(log.status)}
                  <div>
                    <p className="font-medium text-gray-900">{log.employeeName}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(log.syncedAt + 'Z').toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    Fetched: {log.leadsFetched} | Imported: {log.leadsImported}
                  </p>
                  <p className="text-sm text-gray-500 capitalize">{log.syncType} sync</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
