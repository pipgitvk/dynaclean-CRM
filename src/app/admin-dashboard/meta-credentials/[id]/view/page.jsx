'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';
import MetaFormAssignments from '@/components/MetaFormAssignments';
import MetaFormLeadsTable from '@/components/MetaFormLeadsTable';

export default function ViewCredentialPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [credential, setCredential] = useState(null);

  useEffect(() => {
    fetchCredential();
    fetchEmployees();
  }, [params.id]);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await axios.get('/api/employees/active');
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchCredential = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/meta-credentials/${params.id}`);
      if (response.data.success) {
        setCredential(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch credential');
      console.error(error);
      router.push('/admin-dashboard/meta-credentials');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-600">Credential not found</div>
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
          Back to Credentials
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Employee Assignments</h1>
        <p className="text-gray-600 text-sm md:text-base">
          Manage employee assignments for {credential.employeeName}
        </p>
      </div>

      {/* Credential Info Card */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Credential Details</h2>
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <div>
            <label className="text-xs md:text-sm font-medium text-gray-500">Page ID</label>
            <p className="text-gray-900 font-mono text-sm break-all">{credential.pageId}</p>
          </div>
          <div>
            <label className="text-xs md:text-sm font-medium text-gray-500">Status</label>
            <p className={`font-semibold ${credential.isActive ? 'text-green-600' : 'text-gray-600'}`}>
              {credential.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
          <div>
            <label className="text-xs md:text-sm font-medium text-gray-500">Form IDs</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {Array.isArray(credential.formIds) && credential.formIds.length > 0 ? (
                credential.formIds.map((formId, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                    {formId}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm">No form IDs</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Employee Assignments */}
      {loadingEmployees ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <MetaFormAssignments formIds={credential.formIds} employees={employees} />
      )}

      {/* Form Leads Table */}
      <MetaFormLeadsTable formIds={credential.formIds} />
    </div>
  );
}
