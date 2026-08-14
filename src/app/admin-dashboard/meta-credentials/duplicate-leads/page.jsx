'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft, Calendar, Copy, RefreshCw, Search, Users } from 'lucide-react';

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaultMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
}

function formatIstDateTime(value) {
  if (!value) return '-';

  const raw = String(value).trim();
  const hasTimezone = /[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw);
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(hasTimezone ? raw : `${normalized}Z`);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function getFollowupDateTwoMinutesAfter(createdAt) {
  if (!createdAt) return null;
  const raw = String(createdAt).trim();
  const hasTimezone = /[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw);
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(hasTimezone ? raw : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + 2 * 60 * 1000);
}

export default function DuplicateMetaLeadsPage() {
  const defaultRange = getDefaultMonthRange();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDuplicates();
  }, [page, startDate, endDate]);

  const fetchDuplicates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        skip: String((page - 1) * limit),
        limit: String(limit),
        startDate,
        endDate,
      });

      const response = await axios.get(`/api/meta-leads/duplicates?${params.toString()}`);
      if (response.data.success) {
        setLeads(response.data.data);
        setTotal(response.data.pagination.total);
      }
    } catch (error) {
      toast.error('Failed to fetch duplicate leads');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDateChange = (value) => {
    setStartDate(value);
    setPage(1);
    if (value && endDate && value > endDate) {
      setEndDate(value);
    }
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    setPage(1);
    if (value && startDate && value < startDate) {
      setStartDate(value);
    }
  };

  const resetToCurrentMonth = () => {
    const range = getDefaultMonthRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setPage(1);
  };

  const handleProcessFollowups = async () => {
    if (!confirm(`Apply 2-minute follow-up dates for duplicates from ${startDate} to ${endDate}?`)) {
      return;
    }

    try {
      setProcessing(true);
      const response = await axios.post('/api/meta-leads/duplicates/process-followups', {
        startDate,
        endDate,
      });

      if (response.data.success) {
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to process duplicate follow-ups');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;

    const q = searchQuery.toLowerCase();
    return leads.filter((lead) =>
      [
        lead.leadgenId,
        lead.assignedTo,
        lead.employeeName,
        lead.formId,
        lead.productsInterest,
        lead.crmAssignee,
        lead.crmLeadSource,
        lead.crmSalesRep,
        lead.crmStatus,
        lead.crmCustomerId,
        lead.crmName,
        lead.crmPhone,
        lead.leadData?.first_name,
        lead.leadData?.email,
        lead.leadData?.phone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [leads, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin-dashboard/meta-credentials"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Meta Credentials
        </Link>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-100 text-red-700">
            <Copy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
              Duplicate Meta Leads
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Duplicate leads that were not imported and their assignment details
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="text-sm font-medium text-gray-500 mb-1">Total Duplicates</div>
          <div className="text-3xl font-bold text-red-600">{searchQuery ? filteredLeads.length : total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="text-sm font-medium text-gray-500 mb-1">Showing On Page</div>
          <div className="text-3xl font-bold text-blue-600">{filteredLeads.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="text-sm font-medium text-gray-500 mb-1">Date Range</div>
          <div className="text-sm font-semibold text-gray-800">
            {startDate} to {endDate}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={resetToCurrentMonth}
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
          >
            This Month (1–31)
          </button>
          <button
            type="button"
            onClick={handleProcessFollowups}
            disabled={processing}
            className="px-4 py-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 whitespace-nowrap inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
            {processing ? 'Processing...' : 'Apply 2 Min Follow-up'}
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, assignee, form ID, product interest..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meta Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CRM Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Interest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CRM Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CRM ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                    {searchQuery ? 'No duplicate leads match your search' : 'No duplicate leads found'}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {lead.leadData?.first_name || lead.crmName || '-'}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-1">{lead.leadgenId}</div>
                      <div className="text-xs text-gray-500 mt-1">Form: {lead.formId}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lead.leadData?.phone || lead.crmPhone || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1 font-medium text-indigo-700">
                        <Users className="w-3.5 h-3.5" />
                        {lead.assignedTo}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {lead.assigneeStatus}
                        {lead.employeeName && lead.employeeName !== lead.assignedTo
                          ? ` · ${lead.employeeName}`
                          : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-green-700">{lead.crmAssignee}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Source: {lead.crmLeadSource}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="truncate" title={lead.productsInterest}>
                        {lead.productsInterest}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {lead.crmStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin-dashboard/view-customer/${lead.crmCustomerId}`}
                        className="text-blue-600 hover:text-blue-800 font-mono"
                      >
                        {lead.crmCustomerId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatIstDateTime(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-indigo-700 font-medium">
                      {formatIstDateTime(getFollowupDateTwoMinutesAfter(lead.createdAt))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!searchQuery && totalPages > 1 && (
          <div className="px-4 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
