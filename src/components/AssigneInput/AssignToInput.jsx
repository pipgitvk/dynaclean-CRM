"use client";

import { useState, useEffect } from "react";

export default function AssignToInput({ value, onChange }) {
  const [search, setSearch] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (search.length >= 2) {
        const res = await fetch("/api/search-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ search }),
        });
        const data = await res.json();
        setSuggestions(data);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [search]);

  const handleSelect = (username) => {
    setSearch(username);
    setSuggestions([]);
    onChange(username); // ✅ call parent's setter function
  };

  return (
    <div className="relative">
      <input
        type="text"
        required
        autoComplete="off"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value); // ✅ sync as user types
        }}
        placeholder="Type employee name"
        className="input border border-gray-300 rounded-md p-2 w-full"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 bg-white border border-gray-300 mt-1 rounded-md w-full max-h-40 overflow-y-auto shadow">
          {suggestions.map((user) => (
            <li
              key={user.username}
              onClick={() => handleSelect(user.username)}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              {user.username} {user.userRole}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
