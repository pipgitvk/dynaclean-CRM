"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select option...",
  displayKey = "label",
  valueKey = "value",
  className = "",
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const filteredOptions = options.filter(option => {
    const displayValue = typeof option === "string" ? option : option[displayKey];
    return displayValue && displayValue.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getDisplayText = () => {
    if (!value) return "";
    const option = options.find(opt => {
      const optValue = typeof opt === "string" ? opt : opt[valueKey];
      return optValue === value;
    });
    return option ? (typeof option === "string" ? option : option[displayKey]) : "";
  };

  const handleSelect = (option) => {
    const optValue = typeof option === "string" ? option : option[valueKey];
    onChange(optValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white hover:border-gray-400"
        } ${isOpen ? "ring-2 ring-blue-500" : ""}`}
      >
        <div className="flex items-center justify-between">
          <span className={!value ? "text-gray-500" : "text-gray-900"}>
            {value ? getDisplayText() : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X size={14} className="text-gray-400" />
              </button>
            )}
            <ChevronDown 
              size={16} 
              className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} 
            />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-gray-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const optValue = typeof option === "string" ? option : option[valueKey];
                const displayText = typeof option === "string" ? option : option[displayKey];
                
                return (
                  <div
                    key={index}
                    onClick={() => handleSelect(option)}
                    className={`px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${
                      optValue === value ? "bg-blue-100 text-blue-700" : "text-gray-700"
                    }`}
                  >
                    {displayText}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}