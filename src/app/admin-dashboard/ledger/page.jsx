"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight } from "lucide-react";

export default function LedgerPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      fetchCompanies(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchCompanies = async (query) => {
    setIsLoading(true);
    try {
      console.log("Fetching companies for query:", query);
      const response = await fetch(
        `/api/admin/ledger/search-customers?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      console.log("API Response:", data);
      
      if (!response.ok) {
        console.error("API Error:", data.error);
        setSuggestions([]);
        return;
      }
      
      setSuggestions(data.companies || []);
      setIsOpen(data.companies && data.companies.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Error fetching companies:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setIsOpen(false);
  };

  const handleProceed = () => {
    if (selectedCompany) {
      setLedgerLoading(true);
      const encodedName = encodeURIComponent(selectedCompany.company_name);
      router.push(`/admin-dashboard/ledger/${encodedName}`);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectCompany(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    try {
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const parts = text.split(regex);
      return parts.map((part, idx) =>
        regex.test(part) ? (
          <span key={idx} className="font-semibold text-blue-600">
            {part}
          </span>
        ) : (
          part
        )
      );
    } catch (e) {
      return text;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Ledger</h1>
          <p className="text-gray-600">
            Search for a company by name, phone, ID, or GSTIN to view their ledger
          </p>
        </div>

        {/* Search Container */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 mb-6">
          <div className="space-y-4">
            <div className="relative z-50">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                <Search size={20} />
              </div>

              <input
                type="text"
                placeholder="Search by company name, phone, ID, or GSTIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => searchQuery && suggestions.length > 0 && setIsOpen(true)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder-gray-400"
              />

              {isLoading && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <Loader2 size={20} className="text-blue-500 animate-spin" />
                </div>
              )}

              {/* Suggestions Dropdown - Positioned Below Input */}
              {isOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto bg-white z-50">
                  {suggestions.map((company, index) => (
                    <button
                      key={`${company.customer_id}-${index}`}
                      onClick={() => handleSelectCompany(company)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      type="button"
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                        index === selectedIndex
                          ? "bg-blue-50 text-blue-900"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {highlightMatch(company.company_name, searchQuery)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                        {company.mobile && (
                          <div>📱 {company.mobile}</div>
                        )}
                        {company.customer_id && (
                          <div>🆔 {company.customer_id}</div>
                        )}
                        {company.gst_in && (
                          <div>📋 {company.gst_in}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {isOpen && searchQuery && !isLoading && suggestions.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 rounded-lg p-4 text-center text-gray-500 bg-gray-50 z-50">
                  No companies found matching your search
                </div>
              )}
            </div>

            {/* Proceed Button */}
            {selectedCompany && (
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleProceed}
                  disabled={ledgerLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {ledgerLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span>View Ledger for {selectedCompany.company_name}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCompany(null);
                    setSuggestions([]);
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-6 rounded-lg transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        {!selectedCompany && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              💡 <span className="font-medium">Tip:</span> Start typing to see company suggestions. You can search by:
            </p>
            <ul className="mt-2 text-sm text-blue-800 space-y-1 ml-6">
              <li>• Company name</li>
              <li>• Phone number</li>
              <li>• Customer ID</li>
              <li>• GSTIN</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
