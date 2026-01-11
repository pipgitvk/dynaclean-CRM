"use client";

import { useEffect, useState } from "react";
import { Check, X, RefreshCcw, Eye } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ProfileApprovalsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/empcrm/profile/submissions?status=pending');
      const data = await res.json();
      if (data.success) setSubmissions(data.submissions || []);
      else toast.error(data.error || 'Failed to load submissions');
    } catch (e) {
      toast.error('Error loading submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      const res = await fetch('/api/empcrm/profile/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: id, action: 'approve' })
      });
      const data = await res.json();
      if (data.success) { toast.success('Approved'); load(); }
      else toast.error(data.error || 'Failed to approve');
    } catch (e) { toast.error('Error approving'); }
  };

  const reject = async (id) => {
    const reason = prompt('Enter rejection reason (optional)');
    try {
      const res = await fetch('/api/empcrm/profile/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: id, action: 'reject', rejection_reason: reason || '' })
      });
      const data = await res.json();
      if (data.success) { toast.success('Rejected'); load(); }
      else toast.error(data.error || 'Failed to reject');
    } catch (e) { toast.error('Error rejecting'); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Profile Approvals</h1>
        <button onClick={load} className="px-3 py-2 bg-gray-100 rounded-md text-gray-700 hover:bg-gray-200 flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="text-gray-600">No pending submissions.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EmpID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.empId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(s.submitted_at).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <Link href={`/empcrm/admin-dashboard/profile/approvals/${s.id}`} className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1">
                        <Eye className="w-4 h-4" /> View
                      </Link>
                      <button onClick={() => approve(s.id)} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button onClick={() => reject(s.id)} className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1">
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
