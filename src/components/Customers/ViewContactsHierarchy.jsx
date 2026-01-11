"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, User, Phone, Briefcase, CheckCircle, XCircle, Edit } from "lucide-react";

function ContactNode({ contact, children, level = 0, onEdit }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = children && children.length > 0;

  return (
    <div className={`${level > 0 ? 'ml-8 mt-2' : 'mt-3'}`}>
      <div className={`flex items-start p-3 rounded-lg border ${contact.working ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'} hover:shadow-md transition-shadow`}>
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mr-2 mt-1 text-gray-600 hover:text-gray-800"
          >
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
        )}
        {!hasChildren && <div className="w-5 mr-2" />}

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <User size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-800">{contact.name}</h3>
              {contact.working ? (
                <CheckCircle size={16} className="text-green-600" title="Working" />
              ) : (
                <XCircle size={16} className="text-red-600" title="Not Working" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
            {contact.designation && (
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="text-gray-500" />
                <span>{contact.designation}</span>
              </div>
            )}
            {contact.contact && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-gray-500" />
                <span>{contact.contact}</span>
              </div>
            )}
          </div>

          {contact.report_to_name && (
            <div className="mt-2 text-xs text-gray-500">
              Reports to: <span className="font-medium">{contact.report_to_name}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => onEdit && onEdit(contact)}
          className="ml-3 px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm flex items-center gap-1"
        >
          <Edit size={14} />
          Edit
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div className="border-l-2 border-gray-300 ml-3">
          {children.map((child) => (
            <ContactNode key={child.contact.id} {...child} level={level + 1} onEdit={onEdit} />
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

export default function ViewContactsHierarchy({ contacts, onEdit }) {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 shadow-md text-center">
        <User size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">No contacts found for this customer.</p>
      </div>
    );
  }

  const hierarchy = buildHierarchy(contacts);

  return (
    <div className="bg-gray-50 rounded-lg p-6 shadow-md">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Contact Hierarchy</h3>
      
      <div className="space-y-2">
        {hierarchy.map((node) => (
          <ContactNode key={node.contact.id} {...node} onEdit={onEdit} />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-300 flex items-center gap-6 text-sm text-gray-600">
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
