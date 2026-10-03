'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function ThirdPartyEngineersPage() {
  const router = useRouter();
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  useEffect(() => {
    fetchEngineers();
  }, [search, status, pagination.page]);

  const fetchEngineers = async () => {
    try {
      setLoading(true);
      setAccessDenied(false);
      const offset = (pagination.page - 1) * pagination.limit;
      const params = new URLSearchParams({
        search,
        status,
        limit: pagination.limit,
        offset,
      });

      const response = await fetch(`/api/third-party-engineers?${params}`);

      if (response.status === 403) {
        setAccessDenied(true);
        toast.error('Access denied: Only ADMIN and SERVICE SUPPORT can view this page');
        setTimeout(() => router.push('/user-dashboard'), 2000);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch engineers');
      }

      const data = await response.json();
      setEngineers(data.data || []);
      setPagination((prev) => ({ ...prev, total: data.total }));
    } catch (error) {
      console.error('Error fetching engineers:', error);
      if (!accessDenied) {
        toast.error('Failed to fetch engineers');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (engineer_id, name) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/third-party-engineers/${engineer_id}`, {
        method: 'DELETE',
      });

      if (response.status === 403) {
        toast.error('Access denied: Only ADMIN and SERVICE SUPPORT can delete engineers');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete engineer');
      }

      toast.success('Engineer deleted successfully');
      fetchEngineers();
    } catch (error) {
      console.error('Error deleting engineer:', error);
      toast.error(error.message || 'Failed to delete engineer');
    }
  };

  if (accessDenied) {
    return (
      <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-4">
              <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2M6.5 4h11a1 1 0 011 1v2a1 1 0 01-1 1H6.5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                </svg>
              </div>
              <p className="text-slate-600 font-semibold">Access Denied</p>
              <p className="text-slate-500 mt-2">Only ADMIN and SERVICE SUPPORT can access this page</p>
            </div>
            <Link
              href="/user-dashboard"
              className="text-blue-600 hover:underline"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Third Party Service Engineers</h1>
            <p className="text-slate-600 mt-2">Manage external service engineers</p>
          </div>
          <Link
            href="/user-dashboard/third-party-engineers/add"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex items-center gap-2"
          >
            <span>+</span> Add Engineer
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or mobile..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : engineers.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-slate-500">
              <div className="text-center">
                <p className="text-lg font-semibold mb-2">No engineers found</p>
                <Link
                  href="/user-dashboard/third-party-engineers/add"
                  className="text-blue-600 hover:underline"
                >
                  Create the first one
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Mobile</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">State</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Geo Location</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineers.map((engineer, idx) => (
                      <tr
                        key={engineer.engineer_id}
                        className={`border-b border-slate-200 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                        } hover:bg-slate-100 transition`}
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">{engineer.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{engineer.mobile}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{engineer.email}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{engineer.state || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {engineer.geo_location || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              engineer.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {engineer.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <Link
                              href={`/user-dashboard/third-party-engineers/${engineer.engineer_id}`}
                              className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-xs font-semibold"
                            >
                              View
                            </Link>
                            <Link
                              href={`/user-dashboard/third-party-engineers/${engineer.engineer_id}/edit`}
                              className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition text-xs font-semibold"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 p-6 bg-slate-50 border-t border-slate-200">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    disabled={pagination.page === 1}
                    className="px-3 py-2 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= pagination.page - 1 && pageNum <= pagination.page + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPagination((prev) => ({ ...prev, page: pageNum }))}
                          className={`px-3 py-2 rounded ${
                            pagination.page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (
                      (pageNum === 2 && pagination.page > 3) ||
                      (pageNum === totalPages - 1 && pagination.page < totalPages - 2)
                    ) {
                      return <span key={`ellipsis-${pageNum}`}>...</span>;
                    }
                    return null;
                  })}

                  <button
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))
                    }
                    disabled={pagination.page === totalPages}
                    className="px-3 py-2 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Summary */}
        <div className="mt-6 text-sm text-slate-600">
          Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} engineers
        </div>
      </div>
    </div>
  );
}
