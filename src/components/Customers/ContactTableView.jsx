"use client";

import { CheckCircle, XCircle, User, Phone, Briefcase, Edit } from "lucide-react";

export default function ContactTableView({ contacts, onEdit }) {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 shadow-md text-center">
        <User size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">No contacts found for this customer.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Designation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Reports To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contacts.map((contact) => (
              <tr key={contact.id} className={`hover:bg-gray-50 ${!contact.working ? 'bg-gray-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <User size={16} className="text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-gray-900">{contact.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {contact.contact ? (
                      <>
                        <Phone size={14} className="text-gray-500 mr-2" />
                        <span className="text-sm text-gray-700">{contact.contact}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {contact.designation ? (
                      <>
                        <Briefcase size={14} className="text-gray-500 mr-2" />
                        <span className="text-sm text-gray-700">{contact.designation}</span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {contact.report_to_name ? (
                    <span className="text-sm text-gray-700">{contact.report_to_name}</span>
                  ) : (
                    <span className="text-sm text-gray-400">Top Level</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {contact.working ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle size={16} className="mr-1" />
                      <span className="text-sm">Working</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600">
                      <XCircle size={16} className="mr-1" />
                      <span className="text-sm">Not Working</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onEdit && onEdit(contact)}
                    className="flex items-center gap-1 px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm"
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
