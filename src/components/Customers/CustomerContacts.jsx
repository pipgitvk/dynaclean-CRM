"use client";

import { useState, useEffect } from "react";
import { Plus, Users, List, Network } from "lucide-react";
import AddContactForm from "./AddContactForm";
import EditContactForm from "./EditContactForm";
import ViewContactsHierarchy from "./ViewContactsHierarchy";
import ContactTableView from "./ContactTableView";

export default function CustomerContacts({ customerId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("hierarchy"); // "hierarchy", "table", "add", "edit"
  const [editingContact, setEditingContact] = useState(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/customer-contact?customer_id=${customerId}`);
      const data = await response.json();

      if (data.success) {
        setContacts(data.contacts);
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
      fetchContacts();
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
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setView("hierarchy")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              view === "hierarchy"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <Network size={18} />
            <span className="hidden sm:inline">Hierarchy</span>
          </button>
          
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              view === "table"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <List size={18} />
            <span className="hidden sm:inline">Table</span>
          </button>
          
          <button
            onClick={() => setView("add")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              view === "add"
                ? "bg-green-600 text-white"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            <Plus size={18} />
            <span>Add Contact</span>
          </button>
        </div>
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
          <ViewContactsHierarchy contacts={contacts} onEdit={handleEdit} />
        )}

        {view === "table" && (
          <ContactTableView contacts={contacts} onEdit={handleEdit} />
        )}
      </div>
    </div>
  );
}
