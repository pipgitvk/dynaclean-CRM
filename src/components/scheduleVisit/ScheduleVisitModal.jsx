"use client";

import { useState, useEffect } from "react";
import ScheduleVisitForm from "./ScheduleVisitForm";
import { isModuleKeyAllowed } from "@/lib/moduleAccess";

export default function ScheduleVisitModal({
  customerId: initialCustomerId,
  customerName: initialCustomerName,
  contact: initialContact,
  address: initialAddress,
  showButton = true,
  buttonLabel = "Schedule Visit",
  onCreated,
  variant = "action",
  moduleGated = false,
  prefillVisitAddress = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [moduleAllowed, setModuleAllowed] = useState(!moduleGated);
  const [moduleLoading, setModuleLoading] = useState(moduleGated);
  const [customerSearch, setCustomerSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(
    initialCustomerId
      ? {
          customer_id: initialCustomerId,
          customer_name: initialCustomerName,
          phone: initialContact,
          address: initialAddress,
        }
      : null
  );

  useEffect(() => {
    if (!moduleGated) return;
    fetch("/api/my-modules", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const allowedModules = data?.allowedModules;
        if (!isModuleKeyAllowed("schedule-visits", allowedModules)) {
          setModuleAllowed(false);
        } else {
          setModuleAllowed(true);
        }
      })
      .catch(() => setModuleAllowed(false))
      .finally(() => setModuleLoading(false));
  }, [moduleGated]);

  useEffect(() => {
    if (!isOpen || initialCustomerId) return;

    const term = customerSearch.trim();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(term)}&limit=10&scope=own`,
          { credentials: "include" }
        );
        const data = await res.json();
        setSuggestions(data.success ? data.data || [] : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch, isOpen, initialCustomerId]);

  const openModal = () => {
    if (initialCustomerId) {
      setSelected({
        customer_id: initialCustomerId,
        customer_name: initialCustomerName,
        phone: initialContact,
        address: initialAddress,
      });
    } else {
      setSelected(null);
      setCustomerSearch("");
      setSuggestions([]);
    }
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    if (!initialCustomerId) {
      setSelected(null);
      setCustomerSearch("");
      setSuggestions([]);
    }
  };

  const handleSuccess = () => {
    closeModal();
    onCreated?.();
  };

  const handleSelectCustomer = (customer) => {
    const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim()
      || customer.customer_name
      || "Unnamed";
    setSelected({
      customer_id: customer.customer_id,
      customer_name: name,
      phone: customer.phone,
      address: customer.address,
    });
    setCustomerSearch(name);
    setSuggestions([]);
  };

  const customerName = selected?.customer_name || initialCustomerName;
  const customerId = selected?.customer_id || initialCustomerId;
  const contact = selected?.phone || initialContact;
  const address = selected?.address || initialAddress;

  const buttonClass =
    variant === "primary"
      ? "px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 whitespace-nowrap"
      : "btn w-full md:w-auto md:flex-shrink-0 whitespace-nowrap text-white bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md transition duration-300 text-center";

  if (moduleGated && (moduleLoading || !moduleAllowed)) {
    return null;
  }

  return (
    <>
      {showButton && (
        <button
          type="button"
          onClick={openModal}
          className={buttonClass}
        >
          {buttonLabel}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeModal}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Schedule Visit</h2>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[calc(90vh-64px)] space-y-4">
                {!initialCustomerId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Customer
                    </label>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        if (!e.target.value.trim()) setSelected(null);
                      }}
                      placeholder="Name, phone, company..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                    {searching && (
                      <p className="text-xs text-gray-500 mt-1">Searching...</p>
                    )}
                    {suggestions.length > 0 && !selected && (
                      <ul className="mt-1 border border-gray-200 rounded-md divide-y max-h-40 overflow-y-auto">
                        {suggestions.map((c) => {
                          const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim()
                            || c.customer_name;
                          return (
                            <li key={c.customer_id}>
                              <button
                                type="button"
                                onClick={() => handleSelectCustomer(c)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50"
                              >
                                <span className="font-medium">{name}</span>
                                {c.phone && (
                                  <span className="text-gray-500 ml-2">{c.phone}</span>
                                )}
                                {c.company && (
                                  <span className="text-gray-400 block text-xs">{c.company}</span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {customerId && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 space-y-1">
                    <p><strong>Customer:</strong> {customerName}</p>
                    {contact && <p><strong>Contact:</strong> {contact}</p>}
                    {selected && !initialCustomerId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(null);
                          setCustomerSearch("");
                        }}
                        className="text-xs text-violet-600 hover:underline"
                      >
                        Change customer
                      </button>
                    )}
                  </div>
                )}

                {customerId ? (
                  <ScheduleVisitForm
                    key={customerId}
                    customerId={customerId}
                    customerName={customerName}
                    contact={contact}
                    address={address}
                    onSuccess={handleSuccess}
                    prefillVisitAddress={prefillVisitAddress}
                  />
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Search and select a customer to schedule a visit
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
