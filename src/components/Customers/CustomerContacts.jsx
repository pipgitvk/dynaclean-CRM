"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Plus, List, Network } from "lucide-react";
import AddContactForm from "./AddContactForm";
import EditContactForm from "./EditContactForm";
import CustomerContactHierarchyList from "./CustomerContactHierarchyList";
import CustomerContactHierarchyChart from "./CustomerContactHierarchyChart";
import ContactTableView from "./ContactTableView";

export default function CustomerContacts({ customerId, userRole = "" }) {
  const pathname = usePathname();
  const basePath = pathname?.includes("admin-dashboard") ? "admin-dashboard" : "user-dashboard";
  const [contacts, setContacts] = useState([]);
  const [chartContacts, setChartContacts] = useState([]);
  const [memberCustomers, setMemberCustomers] = useState([]);
  const [hierarchyParent, setHierarchyParent] = useState(null);
  const [hierarchySiblings, setHierarchySiblings] = useState([]);
  const [hierarchyMembers, setHierarchyMembers] = useState([]);
  const [hierarchyCurrent, setHierarchyCurrent] = useState(null);
  const [hierarchyFamilyRoot, setHierarchyFamilyRoot] = useState(null);
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
        setChartContacts(data.chartContacts || data.contacts || []);
        setMemberCustomers(data.memberCustomers || []);
        setHierarchyParent(data.hierarchyParent || null);
        setHierarchySiblings(data.hierarchySiblings || []);
        setHierarchyMembers(data.hierarchyMembers || []);
        setHierarchyCurrent(data.hierarchyCurrent || null);
        setHierarchyFamilyRoot(data.hierarchyFamilyRoot || null);
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
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-4 sm:p-6 shadow-md border border-gray-200">
              <h3 className="mb-4 text-lg font-semibold text-gray-800 sm:text-xl">
                Parent · child chart
              </h3>
              <CustomerContactHierarchyChart
                contacts={chartContacts.length ? chartContacts : contacts}
                hierarchyParent={hierarchyParent}
                hierarchyFamilyRoot={hierarchyFamilyRoot}
                siblingContacts={hierarchySiblings}
                hierarchyMembers={hierarchyMembers}
                currentCustomer={hierarchyCurrent}
                dashboardBase={basePath}
              />
            </div>
            <div className="rounded-lg bg-gray-50 p-4 sm:p-6 shadow-md">
              <h3 className="mb-4 text-lg font-semibold text-gray-800 sm:text-xl">
                Contact Hierarchy
              </h3>
              <CustomerContactHierarchyList
                layout="grid"
                parentContact={hierarchyParent}
                siblingContacts={hierarchySiblings}
                childContacts={hierarchyMembers}
                currentCustomer={hierarchyCurrent}
                dashboardBase={basePath}
                userRole={userRole}
              />
            </div>
          </div>
        )}

        {view === "table" && (
          <ContactTableView contacts={contacts} onEdit={handleEdit} />
        )}
      </div>
    </div>
  );
}
