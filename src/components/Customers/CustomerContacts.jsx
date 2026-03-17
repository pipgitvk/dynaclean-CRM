"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Plus, List, Network } from "lucide-react";
import AddContactForm from "./AddContactForm";
import EditContactForm from "./EditContactForm";
import ViewContactsHierarchy from "./ViewContactsHierarchy";
import ContactTableView from "./ContactTableView";

export default function CustomerContacts({ customerId }) {
  const pathname = usePathname();
  const basePath = pathname?.includes("admin-dashboard") ? "admin-dashboard" : "user-dashboard";
  const [contacts, setContacts] = useState([]);
  const [memberCustomers, setMemberCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("hierarchy"); // "hierarchy", "table", "add", "edit"
  const [editingContact, setEditingContact] = useState(null);

  const fetchContacts = async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/customer-contact?customer_id=${encodeURIComponent(customerId)}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await response.json();

      if (data.success) {
        setContacts(data.contacts || []);
        setMemberCustomers(data.memberCustomers || []);
      } else {
        setError(data.error || "Failed to fetch contacts");
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
      setError("Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      setError("");
      fetchContacts();
    } else {
      setLoading(false);
      setError("Customer ID is required");
    }
  }, [customerId]);

  const handleContactAdded = () => {
    fetchContacts();
    setView("hierarchy");
  };

  const handleContactUpdated = () => {
    fetchContacts();
    setEditingContact(null);
    setView("hierarchy");
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setView("edit");
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-8 shadow-md text-center">
        <p className="text-gray-500">Loading contacts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with View Toggles */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          onClick={() => setView("hierarchy")}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md transition-colors text-sm ${
            view === "hierarchy"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          <Network size={18} className="flex-shrink-0" />
          <span>Hierarchy</span>
        </button>
        
        <button
          onClick={() => setView("table")}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md transition-colors text-sm ${
            view === "table"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          <List size={18} className="flex-shrink-0" />
          <span>Table</span>
        </button>
        
        <button
          onClick={() => setView("add")}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md transition-colors text-sm ${
            view === "add"
              ? "bg-green-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          <Plus size={18} className="flex-shrink-0" />
          <span>Add Contact</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Content Area */}
      <div className="mt-6">
        {view === "add" && (
          <AddContactForm
            customerId={customerId}
            existingContacts={contacts}
            onSuccess={handleContactAdded}
            onCancel={() => setView("hierarchy")}
          />
        )}

        {view === "edit" && editingContact && (
          <EditContactForm
            contact={editingContact}
            existingContacts={contacts}
            onSuccess={handleContactUpdated}
            onCancel={() => {
              setEditingContact(null);
              setView("hierarchy");
            }}
          />
        )}

        {view === "hierarchy" && (
          <ViewContactsHierarchy
            contacts={contacts}
            memberCustomers={memberCustomers}
            basePath={basePath}
            onEdit={handleEdit}
          />
        )}

        {view === "table" && (
          <ContactTableView contacts={contacts} onEdit={handleEdit} />
        )}
      </div>
    </div>
  );
}
