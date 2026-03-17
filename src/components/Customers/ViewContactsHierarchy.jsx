"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, User, Phone, Briefcase, CheckCircle, XCircle, Edit, ExternalLink } from "lucide-react";

function ContactNode({ contact, children, level = 0, onEdit, basePath = "user-dashboard" }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = children && children.length > 0;
  const customerId = contact.customer_id ?? contact.id;

  return (
    <div className={`${level > 0 ? 'ml-4 sm:ml-8 mt-2' : 'mt-3'}`}>
      <div className={`flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-0 p-3 rounded-lg border ${contact.working ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'} hover:shadow-md transition-shadow`}>
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {hasChildren && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-gray-600 hover:text-gray-800 flex-shrink-0"
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          )}
          {!hasChildren && <div className="w-5 flex-shrink-0" />}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <User size={18} className="text-blue-600 flex-shrink-0" />
              <h3 className="font-semibold text-gray-800 break-words">{contact.name}</h3>
              {contact.working ? (
                <CheckCircle size={16} className="text-green-600 flex-shrink-0" title="Working" />
              ) : (
                <XCircle size={16} className="text-red-600 flex-shrink-0" title="Not Working" />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
              {contact.designation && (
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className="text-gray-500 flex-shrink-0" />
                  <span className="break-words">{contact.designation}</span>
                </div>
              )}
              {contact.contact && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-500 flex-shrink-0" />
                  <span className="break-all">{contact.contact}</span>
                </div>
              )}
            </div>

            {contact.report_to_name && (
              <div className="mt-2 text-xs text-gray-500">
                Reports to: <span className="font-medium">{contact.report_to_name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:ml-3 flex-shrink-0">
          {customerId && (
            <Link
              href={`/${basePath}/view-customer/${customerId}`}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm flex items-center gap-1"
            >
              <ExternalLink size={14} />
              View
            </Link>
          )}
          <button
            onClick={() => onEdit && onEdit(contact)}
            className="px-3 py-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm flex items-center gap-1"
          >
            <Edit size={14} />
            Edit
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="border-l-2 border-gray-300 ml-3">
          {children.map((child) => (
            <ContactNode key={child.contact.id} {...child} level={level + 1} onEdit={onEdit} basePath={basePath} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildHierarchy(contacts) {
  // Create a map of contacts by ID
  const contactMap = new Map(contacts.map(c => [c.id, { contact: c, children: [] }]));

  // Root level contacts (no report_to)
  const roots = [];

  // Build the tree
  contacts.forEach(contact => {
    const node = contactMap.get(contact.id);
    
    if (contact.report_to) {
      // This contact reports to someone
      const parent = contactMap.get(contact.report_to);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      // No report_to, this is a root level contact
      roots.push(node);
    }
  });

  return roots;
}

function MemberCustomerCard({ member, basePath = "user-dashboard" }) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || "Unnamed";
  const viewUrl = `/${basePath}/view-customer/${member.customer_id}`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border bg-purple-50 border-purple-200 hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <User size={18} className="text-purple-600 flex-shrink-0" />
        <div className="min-w-0">
          <span className="font-semibold text-gray-800 break-words">{name}</span>
          <span className="ml-1 sm:ml-2 text-xs text-purple-600 whitespace-nowrap">(ID: {member.customer_id})</span>
        </div>
        {member.phone && (
          <div className="flex items-center gap-1 text-sm text-gray-600 w-full sm:w-auto">
            <Phone size={14} className="flex-shrink-0" />
            <span className="break-all">{member.phone}</span>
          </div>
        )}
      </div>
      <Link
        href={viewUrl}
        className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm flex-shrink-0 w-full sm:w-auto"
      >
        <ExternalLink size={14} />
        View Customer
      </Link>
    </div>
  );
}

export default function ViewContactsHierarchy({ contacts, memberCustomers = [], basePath = "user-dashboard", onEdit }) {
  const hasContacts = contacts && contacts.length > 0;
  const hasMembers = memberCustomers && memberCustomers.length > 0;

  if (!hasContacts && !hasMembers) {
    return (
      <div className="bg-white rounded-lg p-8 shadow-md text-center">
        <User size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">No contacts or member customers found.</p>
      </div>
    );
  }

  const hierarchy = hasContacts ? buildHierarchy(contacts) : [];

  return (
    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 shadow-md">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Contact Hierarchy</h3>
      
      {hasContacts && (
        <div className="space-y-2">
          {hierarchy.map((node) => (
            <ContactNode key={node.contact.id} {...node} onEdit={onEdit} basePath={basePath} />
          ))}
        </div>
      )}

      {hasMembers && !hasContacts && (
        <div className="mt-6">
          <h4 className="text-base sm:text-lg font-medium text-gray-700 mb-3">Member Customers (Linked)</h4>
          <div className="space-y-2">
            {memberCustomers.map((m) => (
              <MemberCustomerCard key={m.customer_id} member={m} basePath={basePath} />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-300 flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green-600" />
          <span>Working</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle size={16} className="text-red-600" />
          <span>Not Working</span>
        </div>
      </div>
    </div>
  );
}
