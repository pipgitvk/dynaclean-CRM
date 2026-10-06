'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { PhoneCall } from 'lucide-react';

export default function ViewThirdPartyEngineerPage() {
  const params = useParams();
  const router = useRouter();
  const engineer_id = params.engineer_id;

  const [engineer, setEngineer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (engineer_id) {
      fetchEngineer();
    }
  }, [engineer_id]);

  const fetchEngineer = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/third-party-engineers/${engineer_id}`);

      if (response.status === 403) {
        toast.error('Access denied: Only ADMIN and SERVICE SUPPORT can view this page');
        router.push('/user-dashboard');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch engineer');
      }

      const data = await response.json();
      setEngineer(data);
    } catch (error) {
      console.error('Error fetching engineer:', error);
      toast.error('Failed to fetch engineer details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!engineer) {
    return (
      <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-slate-600 mb-4">Engineer not found</p>
            <Link
              href="/user-dashboard/third-party-engineers"
              className="text-blue-600 hover:underline"
            >
              Back to list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/user-dashboard/third-party-engineers"
            className="text-blue-600 hover:text-blue-700 text-xl"
          >
            ←
          </Link>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-slate-900">{engineer.name}</h1>
            <p className="text-slate-600 mt-2">View third-party engineer details</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/user-dashboard/third-party-engineers/${engineer_id}/followup`}
              className="inline-flex items-center justify-center p-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
              title="Add follow-up"
              aria-label="Add follow-up"
            >
              <PhoneCall size={20} />
            </Link>
            <Link
              href={`/user-dashboard/third-party-engineers/${engineer_id}/edit`}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              Edit
            </Link>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Name</label>
              <p className="text-lg font-semibold text-slate-900">{engineer.name}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Status</label>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  engineer.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {engineer.status}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Mobile</label>
              <a href={`tel:${engineer.mobile}`} className="text-lg font-semibold text-blue-600 hover:underline">
                {engineer.mobile}
              </a>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Secondary Contact</label>
              {engineer.secondary_contact_number ? (
                <a
                  href={`tel:${engineer.secondary_contact_number}`}
                  className="text-lg font-semibold text-blue-600 hover:underline"
                >
                  {engineer.secondary_contact_number}
                </a>
              ) : (
                <p className="text-slate-700">N/A</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Service Charge</label>
              <p className="text-lg font-semibold text-slate-900">
                {engineer.service_charge != null && engineer.service_charge !== ''
                  ? `₹${Number(engineer.service_charge).toLocaleString('en-IN')}`
                  : 'N/A'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Email</label>
              <a href={`mailto:${engineer.email}`} className="text-lg font-semibold text-blue-600 hover:underline">
                {engineer.email}
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
              Address Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Address</label>
                <p className="text-slate-700 whitespace-pre-wrap">{engineer.address || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">State</label>
                <p className="text-slate-700">{engineer.state || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Geo Location</label>
                <p className="text-slate-700">{engineer.geo_location || 'N/A'}</p>
              </div>
            </div>
          </div>

          {engineer.remark && (
            <div className="mt-8 pt-8 border-t border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
                Remark
              </h2>
              <p className="text-slate-700 whitespace-pre-wrap">{engineer.remark}</p>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-slate-200 text-xs text-slate-500">
            <p>Created: {new Date(engineer.created_at).toLocaleString()}</p>
            <p>Last Updated: {new Date(engineer.updated_at).toLocaleString()}</p>
          </div>
        </div>

        {/* Attachments */}
        {engineer.attachments && engineer.attachments.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b-2 border-blue-500">
              Attachments
            </h2>

            <div className="space-y-3">
              {engineer.attachments.map((attachment) => (
                <div
                  key={attachment.attachment_id}
                  className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-400 transition"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{attachment.attachment_name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Created: {new Date(attachment.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <a
                    href={attachment.file_url || `/api/serve-file?path=public${attachment.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-semibold"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Attachments */}
        {(!engineer.attachments || engineer.attachments.length === 0) && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-slate-500">
            <p>No attachments</p>
          </div>
        )}
      </div>
    </div>
  );
}
