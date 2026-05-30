'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SkippedLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('skipped'); // 'skipped' or 'duplicates'
  const [duplicates, setDuplicates] = useState([]);
  const [duplicateTotal, setDuplicateTotal] = useState(0);
  const [filteredDuplicates, setFilteredDuplicates] = useState([]);

  useEffect(() => {
    setSearchQuery('');
    if (activeTab === 'skipped') {
      fetchLeads();
      fetchTotalLeads();
    } else {
      fetchDuplicates();
    }
  }, [page, activeTab]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = leads.filter(lead =>
        lead.leadgen_id?.toString().toLowerCase().includes(query) ||
        lead.employee_name?.toLowerCase().includes(query) ||
        lead.form_id?.toString().toLowerCase().includes(query) ||
        lead.leadData?.first_name?.toLowerCase().includes(query) ||
        lead.leadData?.full_name?.toLowerCase().includes(query) ||
        lead.leadData?.email?.toLowerCase().includes(query) ||
        lead.leadData?.phone?.toLowerCase().includes(query)
      );
      setFilteredLeads(filtered);

      const filteredDup = duplicates.filter(lead =>
        lead.leadgen_id?.toString().toLowerCase().includes(query) ||
        lead.employee_name?.toLowerCase().includes(query) ||
        lead.form_id?.toString().toLowerCase().includes(query) ||
        lead.leadData?.first_name?.toLowerCase().includes(query) ||
        lead.leadData?.full_name?.toLowerCase().includes(query) ||
        lead.leadData?.email?.toLowerCase().includes(query) ||
        lead.leadData?.phone?.toLowerCase().includes(query)
      );
      setFilteredDuplicates(filteredDup);
    } else {
      setFilteredLeads(leads);
      setFilteredDuplicates(duplicates);
    }
  }, [searchQuery, leads, duplicates]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        isImported: 'false',
        unique: 'false'
      });

      const response = await axios.get(`/api/meta-leads?${params.toString()}`);
      if (response.data.success) {
        setLeads(response.data.data);
        setFilteredLeads(response.data.data);
        setTotal(response.data.pagination.total);
      }
    } catch (error) {
      toast.error('Failed to fetch skipped leads');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalLeads = async () => {
    try {
      const response = await axios.get('/api/meta-leads/count');
      if (response.data.success) {
        setTotalLeads(response.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch total leads count');
    }
  };

  const fetchDuplicates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        skip: ((page - 1) * limit).toString(),
        limit: limit.toString()
      });

      const response = await axios.get(`/api/meta-leads/duplicates?${params.toString()}`);
      if (response.data.success) {
        setDuplicates(response.data.data);
        setFilteredDuplicates(response.data.data);
        setDuplicateTotal(response.data.pagination.total);
      }
    } catch (error) {
      toast.error('Failed to fetch duplicate leads');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin-dashboard/meta-credentials"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Credentials
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Skipped Leads</h1>
        <p className="text-gray-600">View all leads that were skipped (duplicates)</p>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => { setActiveTab('skipped'); setPage(1); }}
            className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'skipped' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Skipped Leads
          </button>
          <button
            onClick={() => { setActiveTab('duplicates'); setPage(1); }}
            className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'duplicates' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Duplicates (Meta + CRM)
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {activeTab === 'skipped' ? (
            <>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Total Skipped Leads</div>
                <div className="text-3xl font-bold text-orange-600">{searchQuery ? filteredLeads.length : total}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Total Leads in CRM</div>
                <div className="text-3xl font-bold text-blue-600">{totalLeads}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Total Duplicates</div>
                <div className="text-3xl font-bold text-red-600">{searchQuery ? filteredDuplicates.length : duplicateTotal}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Total Leads in CRM</div>
                <div className="text-3xl font-bold text-blue-600">{totalLeads}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by Lead ID, Employee, Form ID, Name, Email, Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                {activeTab === 'duplicates' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRM Customer ID</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTab === 'skipped' ? (
                filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? 'No leads found matching your search' : 'No skipped leads found'}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {lead.leadgen_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.employee_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {lead.form_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.leadData?.first_name || lead.leadData?.full_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.leadData?.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.leadData?.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(lead.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )
              ) : (
                filteredDuplicates.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                      {searchQuery ? 'No leads found matching your search' : 'No duplicate leads found'}
                    </td>
                  </tr>
                ) : (
                  filteredDuplicates.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {lead.leadgen_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.employee_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {lead.form_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.leadData?.first_name || lead.leadData?.full_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.leadData?.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {lead.leadData?.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600 font-medium">
                        {lead.crm_customer_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(lead.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!searchQuery && (activeTab === 'skipped' ? totalPages > 1 : Math.ceil(duplicateTotal / limit) > 1) && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, activeTab === 'skipped' ? total : duplicateTotal)} of {activeTab === 'skipped' ? total : duplicateTotal} leads
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {page} of {activeTab === 'skipped' ? totalPages : Math.ceil(duplicateTotal / limit)}
              </span>
              <button
                onClick={() => setPage(p => Math.min(activeTab === 'skipped' ? totalPages : Math.ceil(duplicateTotal / limit), p + 1))}
                disabled={page === (activeTab === 'skipped' ? totalPages : Math.ceil(duplicateTotal / limit))}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
